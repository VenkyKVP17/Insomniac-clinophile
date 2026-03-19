import subprocess
import json
import sys

def test_gemini():
    cmd = ["gemini", "hello", "--yolo", "-o", "json"]
    print(f"Running: {' '.join(cmd)}")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        print(f"Return code: {proc.returncode}")
        print(f"Stdout: {proc.stdout}")
        print(f"Stderr: {proc.stderr}")
        
        # Try to parse JSON
        out = proc.stdout
        idx = out.find('{')
        if idx != -1:
            try:
                data = json.loads(out[idx:])
                print("JSON parsed successfully!")
                print(f"Session ID: {data.get('session_id')}")
            except Exception as e:
                print(f"JSON Parse Error: {e}")
        else:
            print("No JSON found in output")
            
    except subprocess.TimeoutExpired:
        print("Command timed out after 30 seconds")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_gemini()
