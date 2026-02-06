// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;

const PORT: u16 = 3000;

#[cfg(target_os = "windows")]
const NODE_BINARY: &str = "node.exe";
#[cfg(not(target_os = "windows"))]
const NODE_BINARY: &str = "node";

struct ServerProcess(Mutex<Option<Child>>);

fn get_resource_path(app: &tauri::AppHandle) -> PathBuf {
    // In development, use the current directory + bundle
    // In production, use the resource directory
    if cfg!(debug_assertions) {
        env::current_dir().unwrap().join("bundle")
    } else {
        app.path().resource_dir().unwrap()
    }
}

fn start_server(resource_path: &PathBuf) -> Option<Child> {
    let node_path = resource_path.join("runtime").join(NODE_BINARY);
    let server_path = resource_path.join("server").join("server.js");
    let server_dir = resource_path.join("server");

    println!("Starting server...");
    println!("  Node: {:?}", node_path);
    println!("  Server: {:?}", server_path);
    println!("  CWD: {:?}", server_dir);

    if !node_path.exists() {
        eprintln!("Node.js runtime not found at {:?}", node_path);
        return None;
    }

    if !server_path.exists() {
        eprintln!("Server not found at {:?}", server_path);
        return None;
    }

    let mut cmd = Command::new(&node_path);
    cmd.arg(&server_path)
        .env("NODE_ENV", "production")
        .env("PORT", PORT.to_string())
        .current_dir(&server_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn();

    match child {
        Ok(c) => {
            println!("Server process started with PID: {}", c.id());
            Some(c)
        }
        Err(e) => {
            eprintln!("Failed to start server: {}", e);
            None
        }
    }
}

fn wait_for_server() -> bool {
    println!("Waiting for server to be ready on port {}...", PORT);
    for i in 0..60 {
        if TcpStream::connect(format!("127.0.0.1:{}", PORT)).is_ok() {
            println!("Server ready after {} attempts", i + 1);
            return true;
        }
        thread::sleep(Duration::from_millis(500));
    }
    eprintln!("Server failed to start within timeout");
    false
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let resource_path = get_resource_path(&app.handle());
            
            // Start the Node.js server
            let server = start_server(&resource_path);
            
            if server.is_none() {
                eprintln!("Failed to start server");
                std::process::exit(1);
            }
            
            // Store server process for cleanup
            app.manage(ServerProcess(Mutex::new(server)));
            
            // Wait for server to be ready
            if !wait_for_server() {
                eprintln!("Server timeout - check logs");
                std::process::exit(1);
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Kill the server when window closes
                if let Some(state) = window.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            println!("Stopping server...");
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
