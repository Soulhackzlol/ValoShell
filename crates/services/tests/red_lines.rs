//! ValoShell's red lines, checked over the whole source tree and the dependency lock file:
//! it never buys anything, never reads or writes the game's memory, and never sends input to
//! the game. A change that brings any of these in fails here, before review.
//!
//! The check is textual on purpose: these are API names and endpoint paths no ValoShell code
//! has a reason to mention. `OpenProcess` itself is allowed (the app reads the game window's
//! process name with query-only rights); the memory-access rights are not.

use std::fs;
use std::path::{Path, PathBuf};

/// Store endpoints that spend currency (the store is view-only).
const BUYING: &[&str] = &[
    "store/v1/order",
    "store/v2/order",
    "store/v1/purchase",
    "/purchase/",
];
/// Windows APIs and process rights for touching another process's memory.
const MEMORY: &[&str] = &[
    "ReadProcessMemory",
    "WriteProcessMemory",
    "VirtualQueryEx",
    "VirtualAllocEx",
    "CreateRemoteThread",
    "PROCESS_VM_READ",
    "PROCESS_VM_WRITE",
    "PROCESS_VM_OPERATION",
    "PROCESS_ALL_ACCESS",
];
/// Windows APIs that synthesize keyboard or mouse input.
const INPUT: &[&str] = &[
    "SendInput",
    "keybd_event",
    "mouse_event",
    "SetCursorPos",
    "PostMessageW(",
    "SendMessageW(",
];
/// Crates whose job is input automation or memory access.
const FORBIDDEN_CRATES: &[&str] = &[
    "enigo",
    "rdev",
    "inputbot",
    "autopilot",
    "winput",
    "read-process-memory",
    "process-memory",
    "memflow",
];
/// Source folders scanned, relative to the workspace root.
const SOURCE_DIRS: &[&str] = &["crates", "app/src", "ui/src", "ui/scripts"];
const SOURCE_EXTENSIONS: &[&str] = &["rs", "ts", "tsx", "mjs"];

fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Every source file under `dir`, skipping build output and this file.
fn sources(dir: &Path, found: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if path.is_dir() {
            if name != "target" && name != "node_modules" && name != "bindings" {
                sources(&path, found);
            }
        } else if path
            .extension()
            .is_some_and(|ext| SOURCE_EXTENSIONS.iter().any(|allowed| ext == *allowed))
            && !path.ends_with("tests/red_lines.rs")
        {
            found.push(path);
        }
    }
}

/// `file: term` for every forbidden term any source file mentions.
fn mentions(terms: &[&str]) -> Vec<String> {
    let root = workspace_root();
    let mut files = Vec::new();
    for dir in SOURCE_DIRS {
        sources(&root.join(dir), &mut files);
    }
    assert!(
        files.len() > 100,
        "found only {} source files; is the root right?",
        files.len()
    );
    let mut hits = Vec::new();
    for file in files {
        // An unreadable file must fail the check, not slip past it.
        let text = fs::read_to_string(&file)
            .unwrap_or_else(|error| panic!("cannot read {}: {error}", file.display()));
        for term in terms.iter().filter(|term| text.contains(**term)) {
            hits.push(format!(
                "{}: {term}",
                file.strip_prefix(&root).unwrap_or(&file).display()
            ));
        }
    }
    hits
}

#[test]
fn nothing_can_buy() {
    assert_eq!(mentions(BUYING), Vec::<String>::new());
}

#[test]
fn nothing_touches_game_memory() {
    assert_eq!(mentions(MEMORY), Vec::<String>::new());
}

#[test]
fn nothing_sends_input() {
    assert_eq!(mentions(INPUT), Vec::<String>::new());
}

#[test]
fn no_automation_or_memory_crates() {
    let lock =
        fs::read_to_string(workspace_root().join("Cargo.lock")).expect("Cargo.lock is readable");
    let found: Vec<&str> = FORBIDDEN_CRATES
        .iter()
        .copied()
        .filter(|name| lock.contains(&format!("name = \"{name}\"\n")))
        .collect();
    assert_eq!(found, Vec::<&str>::new());
}
