//! Checking a download as it streams in: its size against what the release says, and its
//! SHA-256 against SHA256SUMS.txt. Pure (bytes in, verdict out), so every branch is tested
//! without a network.

use sha2::{Digest, Sha256};

use super::error::UpdateError;

/// No release exe comes near this; a bigger answer is not ours.
pub const MAX_DOWNLOAD_BYTES: u64 = 256 * 1024 * 1024;
const PERCENT: u64 = 100;

/// Counts and hashes one download chunk by chunk.
pub struct DownloadCheck {
    expected_size: u64,
    received: u64,
    hasher: Sha256,
}

impl DownloadCheck {
    pub fn new(expected_size: u64) -> Self {
        Self {
            expected_size,
            received: 0,
            hasher: Sha256::new(),
        }
    }

    /// Take one chunk; returns how much of the file has arrived, in percent.
    pub fn accept(&mut self, chunk: &[u8]) -> Result<u8, UpdateError> {
        self.received += chunk.len() as u64;
        if self.received > self.expected_size.min(MAX_DOWNLOAD_BYTES) {
            return Err(UpdateError::TooLarge);
        }
        self.hasher.update(chunk);
        Ok(percent_of(self.received, self.expected_size))
    }

    /// The whole file arrived and hashes to `expected_hash` (lowercase hex).
    pub fn finish(self, expected_hash: &str) -> Result<(), UpdateError> {
        if self.received != self.expected_size {
            return Err(UpdateError::Truncated);
        }
        let actual = format!("{:x}", self.hasher.finalize());
        if actual != expected_hash {
            return Err(UpdateError::HashMismatch);
        }
        Ok(())
    }
}

pub fn percent_of(received: u64, total: u64) -> u8 {
    let percent = (received * PERCENT).checked_div(total).unwrap_or(PERCENT);
    u8::try_from(percent.min(PERCENT)).unwrap_or(u8::MAX)
}
