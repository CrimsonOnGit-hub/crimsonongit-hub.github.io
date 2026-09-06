"""
CrimsonFlame Server Controller - Desktop Management Software
Controls real-time server downtime, 503 outage mode, and live diagnostics.
"""

import sys
import time
import json
import threading
import webbrowser
import urllib.request
import urllib.error
import tkinter as tk
from tkinter import messagebox

DEFAULT_URL = "https://crimsonflame.net"
DEFAULT_SECRET = "crimson-cf-2026"

class CrimsonControllerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CrimsonFlame | Server Controller")
        self.root.geometry("620x680")
        self.root.minsize(560, 600)
        self.root.configure(bg="#0a0e14")

        # Set window icon if available or configure style
        self.is_monitoring = True
        self.last_status = "UNKNOWN"

        self.setup_ui()
        self.start_monitoring_thread()

    def setup_ui(self):
        # ─── HEADER BAR ───
        header_frame = tk.Frame(self.root, bg="#121820", height=80)
        header_frame.pack(fill="x", side="top")

        title_label = tk.Label(
            header_frame,
            text="🔥 CRIMSONFLAME",
            font=("Segoe UI", 18, "bold"),
            fg="#ff4d6d",
            bg="#121820"
        )
        title_label.pack(anchor="w", padx=24, pady=(14, 2))

        sub_label = tk.Label(
            header_frame,
            text="Production Server Control Panel & Outage Switch",
            font=("Segoe UI", 10),
            fg="#8b949e",
            bg="#121820"
        )
        sub_label.pack(anchor="w", padx=24, pady=(0, 14))

        # ─── MAIN CONTAINER ───
        main_frame = tk.Frame(self.root, bg="#0a0e14", padx=24, pady=18)
        main_frame.pack(fill="both", expand=True)

        # ─── CONNECTION CONFIG CARD ───
        config_card = tk.LabelFrame(
            main_frame,
            text=" Connection Settings ",
            font=("Segoe UI", 10, "bold"),
            fg="#c9d1d9",
            bg="#161b22",
            bd=1,
            relief="solid",
            padx=16,
            pady=12
        )
        config_card.pack(fill="x", pady=(0, 14))

        # URL row
        url_row = tk.Frame(config_card, bg="#161b22")
        url_row.pack(fill="x", pady=4)
        tk.Label(url_row, text="Target URL:", font=("Segoe UI", 9, "bold"), fg="#8b949e", bg="#161b22", width=12, anchor="w").pack(side="left")
        self.url_entry = tk.Entry(url_row, font=("Segoe UI", 10), bg="#0d1117", fg="#58a6ff", insertbackground="#fff", bd=1, relief="solid")
        self.url_entry.insert(0, DEFAULT_URL)
        self.url_entry.pack(side="left", fill="x", expand=True, padx=(4, 0))

        # Secret Key row
        secret_row = tk.Frame(config_card, bg="#161b22")
        secret_row.pack(fill="x", pady=4)
        tk.Label(secret_row, text="Admin Secret:", font=("Segoe UI", 9, "bold"), fg="#8b949e", bg="#161b22", width=12, anchor="w").pack(side="left")
        self.secret_entry = tk.Entry(secret_row, font=("Segoe UI", 10), bg="#0d1117", fg="#c9d1d9", insertbackground="#fff", show="•", bd=1, relief="solid")
        self.secret_entry.insert(0, DEFAULT_SECRET)
        self.secret_entry.pack(side="left", fill="x", expand=True, padx=(4, 0))

        # ─── LIVE STATUS CARD ───
        status_card = tk.Frame(main_frame, bg="#161b22", bd=1, relief="solid", padx=20, pady=16)
        status_card.pack(fill="x", pady=(0, 16))

        tk.Label(status_card, text="CURRENT SERVER STATE", font=("Segoe UI", 9, "bold"), fg="#8b949e", bg="#161b22").pack(anchor="center")

        self.status_pill = tk.Label(
            status_card,
            text="⏳ CONNECTING...",
            font=("Segoe UI", 16, "bold"),
            fg="#f0883e",
            bg="#261d15",
            padx=20,
            pady=6,
            bd=1,
            relief="solid"
        )
        self.status_pill.pack(anchor="center", pady=(8, 4))

        self.status_detail = tk.Label(
            status_card,
            text="Checking server response...",
            font=("Segoe UI", 9),
            fg="#8b949e",
            bg="#161b22"
        )
        self.status_detail.pack(anchor="center")

        # ─── ACTION BUTTONS ───
        btn_frame = tk.Frame(main_frame, bg="#0a0e14")
        btn_frame.pack(fill="x", pady=(0, 16))

        # STOP BUTTON (Big Red)
        self.btn_stop = tk.Button(
            btn_frame,
            text="🛑 STOP SERVER\n(Trigger 503 Outage)",
            font=("Segoe UI", 11, "bold"),
            bg="#dc2626",
            fg="#ffffff",
            activebackground="#b91c1c",
            activeforeground="#ffffff",
            bd=0,
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=10,
            command=self.action_stop_server
        )
        self.btn_stop.pack(side="left", fill="x", expand=True, padx=(0, 6))

        # START BUTTON (Big Green)
        self.btn_start = tk.Button(
            btn_frame,
            text="🟢 START SERVER\n(Bring Back Online)",
            font=("Segoe UI", 11, "bold"),
            bg="#16a34a",
            fg="#ffffff",
            activebackground="#15803d",
            activeforeground="#ffffff",
            bd=0,
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=10,
            command=self.action_start_server
        )
        self.btn_start.pack(side="right", fill="x", expand=True, padx=(6, 0))

        # Utility Buttons Row
        util_frame = tk.Frame(main_frame, bg="#0a0e14")
        util_frame.pack(fill="x", pady=(0, 16))

        btn_crash = tk.Button(
            util_frame,
            text="💥 Simulate Crash (500)",
            font=("Segoe UI", 9, "bold"),
            bg="#30363d",
            fg="#c9d1d9",
            activebackground="#21262d",
            bd=0,
            relief="flat",
            cursor="hand2",
            padx=10,
            pady=6,
            command=self.action_simulate_crash
        )
        btn_crash.pack(side="left", fill="x", expand=True, padx=(0, 4))

        btn_open = tk.Button(
            util_frame,
            text="🌐 Open in Browser",
            font=("Segoe UI", 9, "bold"),
            bg="#238636",
            fg="#ffffff",
            activebackground="#2ea043",
            bd=0,
            relief="flat",
            cursor="hand2",
            padx=10,
            pady=6,
            command=self.action_open_browser
        )
        btn_open.pack(side="right", fill="x", expand=True, padx=(4, 0))

        # ─── REALTIME CONSOLE / ACTIVITY LOG ───
        log_header = tk.Label(
            main_frame,
            text="ACTIVITY & DIAGNOSTIC LOG",
            font=("Segoe UI", 9, "bold"),
            fg="#8b949e",
            bg="#0a0e14",
            anchor="w"
        )
        log_header.pack(fill="x", pady=(0, 4))

        log_container = tk.Frame(main_frame, bg="#0d1117", bd=1, relief="solid")
        log_container.pack(fill="both", expand=True)

        self.log_text = tk.Text(
            log_container,
            bg="#0d1117",
            fg="#c9d1d9",
            font=("Consolas", 9),
            bd=0,
            padx=8,
            pady=6,
            wrap="word",
            state="disabled"
        )
        self.log_text.pack(side="left", fill="both", expand=True)

        scrollbar = tk.Scrollbar(log_container, command=self.log_text.yview)
        scrollbar.pack(side="right", fill="y")
        self.log_text.config(yscrollcommand=scrollbar.set)

        self.log("CrimsonFlame Controller initialized.")
        self.log(f"Monitoring target: {self.get_url()}")

    def log(self, message):
        timestamp = time.strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}\n"
        self.log_text.config(state="normal")
        self.log_text.insert("end", entry)
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    def get_url(self):
        url = self.url_entry.get().strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        return url.rstrip('/')

    def get_secret(self):
        return self.secret_entry.get().strip()

    def update_status_ui(self, status, detail, is_online):
        if is_online:
            self.status_pill.config(
                text="🟢 ONLINE (200 OK)",
                fg="#3fb950",
                bg="#13231b"
            )
        else:
            self.status_pill.config(
                text="🛑 STOPPED (503 SERVICE UNAVAILABLE)",
                fg="#ff7b72",
                bg="#2e1416"
            )
        self.status_detail.config(text=detail)

    def send_control_request(self, action):
        base_url = self.get_url()
        secret = self.get_secret()
        endpoint = f"{base_url}/api/server/control"

        payload = json.dumps({"action": action, "secret": secret}).encode('utf-8')
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "CrimsonFlameController/1.0"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=6) as response:
                body = response.read().decode('utf-8')
                data = json.loads(body)
                return True, data.get("message", "Success")
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read().decode('utf-8'))
                msg = err_body.get("error", f"HTTP {e.code}")
            except Exception:
                msg = f"HTTP {e.code}: {e.reason}"
            return False, msg
        except Exception as ex:
            return False, str(ex)

    def action_stop_server(self):
        confirm = messagebox.askyesno(
            "Confirm Stop Server",
            "Are you sure you want to stop the server?\n\nAll visitors will immediately receive a 503 Service Unavailable error.",
            parent=self.root
        )
        if not confirm:
            return

        self.log(">> Sending command: STOP SERVER...")
        def run():
            success, msg = self.send_control_request("stop")
            if success:
                self.log(f"SUCCESS: {msg}")
                self.root.after(0, lambda: self.update_status_ui("STOPPED", "Visitors are receiving HTTP 503 error.", False))
            else:
                self.log(f"ERROR stopping server: {msg}")
                messagebox.showerror("Error", f"Could not stop server:\n{msg}", parent=self.root)
        threading.Thread(target=run, daemon=True).start()

    def action_start_server(self):
        self.log(">> Sending command: START SERVER...")
        def run():
            success, msg = self.send_control_request("start")
            if success:
                self.log(f"SUCCESS: {msg}")
                self.root.after(0, lambda: self.update_status_ui("ONLINE", "Server is active and serving traffic.", True))
            else:
                self.log(f"ERROR starting server: {msg}")
                messagebox.showerror("Error", f"Could not start server:\n{msg}", parent=self.root)
        threading.Thread(target=run, daemon=True).start()

    def action_simulate_crash(self):
        self.log(">> Opening crash test route (/trigger-500)...")
        url = f"{self.get_url()}/trigger-500"
        webbrowser.open(url)
        self.log(f"Opened {url} in browser. Should display 500 Internal Server Error.")

    def action_open_browser(self):
        url = self.get_url()
        self.log(f"Opening {url} in browser...")
        webbrowser.open(url)

    def start_monitoring_thread(self):
        def monitor_loop():
            first_run = True
            while self.is_monitoring:
                base_url = self.get_url()
                try:
                    endpoint = f"{base_url}/api/server/state"
                    req = urllib.request.Request(endpoint, headers={"User-Agent": "CrimsonMonitor/1.0"})
                    with urllib.request.urlopen(req, timeout=4) as res:
                        if res.status == 200:
                            data = json.loads(res.read().decode('utf-8'))
                            online = data.get("online", True)
                            uptime = data.get("uptime", 0)
                            status_text = "ONLINE" if online else "STOPPED"
                            detail = f"Uptime: {uptime}s | Code: {data.get('statusCode', 200)}"
                            self.root.after(0, lambda s=status_text, d=detail, o=online: self.update_status_ui(s, d, o))
                except urllib.error.HTTPError as e:
                    if e.code == 503:
                        self.root.after(0, lambda: self.update_status_ui("STOPPED", "503 Service Unavailable (Outage Active)", False))
                    elif e.code == 404:
                        # Server is running older build without /api/server/state
                        try:
                            root_req = urllib.request.Request(base_url, headers={"User-Agent": "CrimsonMonitor/1.0"})
                            with urllib.request.urlopen(root_req, timeout=4) as rres:
                                if rres.status == 200:
                                    self.root.after(0, lambda: self.update_status_ui("ONLINE (Pending Push)", "Site is live. Run 'pushnow' to enable control switch.", True))
                                    if first_run:
                                        self.root.after(0, lambda: self.log("ℹ️ Site is LIVE, but new control API is not deployed yet. Type 'pushnow' to activate full stop/start control."))
                        except Exception:
                            self.root.after(0, lambda: self.status_detail.config(text="Deploy pending on Cloud Run"))
                    else:
                        self.root.after(0, lambda c=e.code: self.status_detail.config(text=f"HTTP {c}"))
                except Exception as ex:
                    self.root.after(0, lambda m=str(ex): self.status_detail.config(text=f"Connection error: {m}"))

                first_run = False
                time.sleep(3)

        thread = threading.Thread(target=monitor_loop, daemon=True)
        thread.start()

def main():
    root = tk.Tk()
    app = CrimsonControllerApp(root)
    root.protocol("WM_DELETE_WINDOW", lambda: (setattr(app, 'is_monitoring', False), root.destroy(), sys.exit(0)))
    root.mainloop()

if __name__ == "__main__":
    main()
