// Simple launcher that starts the Next.js server and opens browser
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::path::PathBuf;
use std::process::{Command, Child};
use std::thread;
use std::time::Duration;
use std::net::TcpStream;

#[cfg(target_os = "windows")]
const NODE_BINARY: &str = "node.exe";
#[cfg(not(target_os = "windows"))]
const NODE_BINARY: &str = "node";

const PORT: u16 = 3000;

fn get_resource_path() -> PathBuf {
    let exe_path = env::current_exe().expect("Failed to get executable path");
    exe_path.parent().unwrap().to_path_buf()
}

fn start_server() -> Option<Child> {
    let resource_path = get_resource_path();
    let node_path = resource_path.join("runtime").join(NODE_BINARY);
    let server_path = resource_path.join("server").join("server.js");
    
    if !node_path.exists() {
        eprintln!("Node.js runtime not found at {:?}", node_path);
        return None;
    }
    
    if !server_path.exists() {
        eprintln!("Server not found at {:?}", server_path);
        return None;
    }
    
    let child = Command::new(&node_path)
        .arg(&server_path)
        .env("NODE_ENV", "production")
        .env("PORT", PORT.to_string())
        .current_dir(resource_path.join("server"))
        .spawn()
        .expect("Failed to start server");
    
    Some(child)
}

fn wait_for_server() -> bool {
    for _ in 0..30 {
        if TcpStream::connect(format!("127.0.0.1:{}", PORT)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(500));
    }
    false
}

fn open_browser() {
    let url = format!("http://localhost:{}", PORT);
    
    #[cfg(target_os = "windows")]
    Command::new("cmd").args(["/C", "start", &url]).spawn().ok();
    
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&url).spawn().ok();
    
    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(&url).spawn().ok();
}

fn main() {
    println!("Starting Claude Usage Dashboard...");
    
    let mut server = start_server().expect("Failed to start server");
    
    println!("Waiting for server to be ready...");
    if wait_for_server() {
        println!("Server ready! Opening browser...");
        open_browser();
        
        println!("Dashboard running at http://localhost:{}", PORT);
        println!("Press Ctrl+C to stop.");
        
        // Wait for server to exit
        server.wait().expect("Server crashed");
    } else {
        eprintln!("Server failed to start within timeout");
        server.kill().ok();
    }
}
