//! UI documents (layouts, themes): opaque JSON the UI owns, stored one file per name under
//! `layouts/` or `themes/`. The backend never interprets them; it only keeps them safe
//! (atomic writes, validated file names, a bad file is reported instead of crashing).

use std::path::{Path, PathBuf};

use serde_json::Value;
use thiserror::Error;

use crate::paths::with_path;

const EXTENSION: &str = "json";
const MAX_NAME_CHARS: usize = 64;
/// Characters Windows refuses in file names.
const FORBIDDEN_NAME_CHARS: [char; 9] = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
/// Documents larger than this are refused (a layout is a few KB; embeds are urls, not data).
const MAX_DOCUMENT_BYTES: usize = 4 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum DocumentError {
    #[error("Invalid name: {0}")]
    InvalidName(String),
    #[error("\"{0}\" is not valid JSON: {1}")]
    Corrupt(String, String),
    #[error("The document is too large ({0} KB); keep images and videos as links.")]
    TooLarge(usize),
    #[error("Could not access saved layouts: {0}")]
    Io(#[from] std::io::Error),
}

fn document_file(dir: &Path, name: &str) -> Result<PathBuf, DocumentError> {
    let name =
        validate_name(name).map_err(|reason| DocumentError::InvalidName(reason.to_owned()))?;
    Ok(dir.join(format!("{name}.{EXTENSION}")))
}

/// A name that is safe as a Windows file name: trimmed, not empty, at most 64 characters, no
/// path or reserved characters and no trailing dot.
fn validate_name(raw: &str) -> Result<&str, &'static str> {
    let name = raw.trim();
    if name.is_empty() {
        return Err("the name is empty");
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err("the name is longer than 64 characters");
    }
    if name
        .chars()
        .any(|char| char.is_control() || FORBIDDEN_NAME_CHARS.contains(&char))
    {
        return Err("the name contains a character Windows does not allow");
    }
    if name.ends_with('.') {
        return Err("the name ends with a dot");
    }
    Ok(name)
}

/// Names of the stored documents, sorted case-insensitively. A missing folder is empty.
pub fn list_documents(dir: &Path) -> Result<Vec<String>, DocumentError> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(with_path(error, dir).into()),
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == EXTENSION))
        .filter_map(|path| {
            path.file_stem()
                .map(|stem| stem.to_string_lossy().into_owned())
        })
        .collect();
    names.sort_by_key(|name| name.to_lowercase());
    Ok(names)
}

/// One document; `None` when it does not exist.
pub fn load_document(dir: &Path, name: &str) -> Result<Option<Value>, DocumentError> {
    let file = document_file(dir, name)?;
    // The looks folder takes files shared by others, so check the size before reading it all.
    if let Ok(metadata) = std::fs::metadata(&file)
        && metadata.len() > MAX_DOCUMENT_BYTES as u64
    {
        let kilobytes = usize::try_from(metadata.len() / 1024).unwrap_or(usize::MAX);
        return Err(DocumentError::TooLarge(kilobytes));
    }
    let text = match std::fs::read_to_string(&file) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(with_path(error, &file).into()),
    };
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|error| DocumentError::Corrupt(name.to_owned(), error.to_string()))
}

/// Write a document atomically, creating the folder if needed.
pub fn save_document(dir: &Path, name: &str, document: &Value) -> Result<(), DocumentError> {
    let file = document_file(dir, name)?;
    let text = serde_json::to_string_pretty(document)
        .map_err(|error| DocumentError::Corrupt(name.to_owned(), error.to_string()))?;
    if text.len() > MAX_DOCUMENT_BYTES {
        return Err(DocumentError::TooLarge(text.len() / 1024));
    }
    std::fs::create_dir_all(dir).map_err(|error| with_path(error, dir))?;
    let temporary = file.with_extension("json.tmp");
    std::fs::write(&temporary, text).map_err(|error| with_path(error, &temporary))?;
    std::fs::rename(&temporary, &file).map_err(|error| with_path(error, &file))?;
    Ok(())
}

/// Where a stored document lives, to show it in the file explorer; `None` when it does not exist.
pub fn document_path(dir: &Path, name: &str) -> Result<Option<PathBuf>, DocumentError> {
    let file = document_file(dir, name)?;
    Ok(file.is_file().then_some(file))
}

/// Delete a document; deleting a missing one is fine.
pub fn delete_document(dir: &Path, name: &str) -> Result<(), DocumentError> {
    let file = document_file(dir, name)?;
    match std::fs::remove_file(&file) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(with_path(error, &file).into()),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("vl-documents-{label}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn saved_documents_round_trip_and_are_listed() {
        let dir = temp_dir("round-trip");
        let document = json!({ "version": 1, "pieces": [{ "id": "clock" }] });

        save_document(&dir, "Stream setup", &document).unwrap();

        assert_eq!(load_document(&dir, "Stream setup").unwrap(), Some(document));
        assert_eq!(list_documents(&dir).unwrap(), ["Stream setup"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_documents_and_folders_are_empty_not_errors() {
        let dir = temp_dir("missing");

        assert_eq!(load_document(&dir, "nothing").unwrap(), None);
        assert!(list_documents(&dir).unwrap().is_empty());
        assert!(delete_document(&dir, "nothing").is_ok());
    }

    #[test]
    fn unsafe_names_are_refused() {
        let dir = temp_dir("names");

        let error = save_document(&dir, "../evil", &json!({})).unwrap_err();

        assert!(matches!(error, DocumentError::InvalidName(_)));
    }

    #[test]
    fn document_path_points_at_saved_documents_only() {
        let dir = temp_dir("path");
        save_document(&dir, "Shared", &json!({})).unwrap();

        let found = document_path(&dir, "Shared").unwrap();

        assert_eq!(found, Some(dir.join("Shared.json")));
        assert_eq!(document_path(&dir, "Missing").unwrap(), None);
        assert!(matches!(
            document_path(&dir, "../Shared"),
            Err(DocumentError::InvalidName(_))
        ));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn oversized_files_are_refused_before_reading() {
        let dir = temp_dir("oversized");
        std::fs::create_dir_all(&dir).unwrap();
        let padding = " ".repeat(MAX_DOCUMENT_BYTES + 1);
        std::fs::write(dir.join("huge.json"), format!("{{}}{padding}")).unwrap();

        let error = load_document(&dir, "huge").unwrap_err();

        assert!(matches!(error, DocumentError::TooLarge(_)));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_files_are_reported() {
        let dir = temp_dir("corrupt");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("broken.json"), "{ nope").unwrap();

        let error = load_document(&dir, "broken").unwrap_err();

        assert!(matches!(error, DocumentError::Corrupt(..)));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
