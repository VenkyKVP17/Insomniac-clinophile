# 📱 NYX → Tasker Alarm Integration Setup Guide

## 🎯 What This Does

Allows you to set phone alarms by texting NYX via Telegram:

**Examples:**
- "Set alarm for 7am"
- "Wake me up at 6:30 tomorrow"
- "Set alarm for 9pm tonight for duty"

NYX will automatically:
1. Parse your natural language request
2. Send HTTP request to your phone
3. Tasker receives it and sets Android alarm
4. Confirms back to you via Telegram

---

## ✅ Server Side (DONE)

The following has been completed on your Pantheon server:

- ✅ Created `nyx-set-alarm` command ([/home/ubuntu/vp/.scripts/nyx-set-alarm.mjs](../../../.scripts/nyx-set-alarm.mjs))
- ✅ Integrated into Gemini YOLO system prompt
- ✅ NYX will automatically detect alarm requests and execute

---

## 📱 Tasker Side (TODO - Reminder for You)

You need to set up Tasker on your Android phone. Here's what to do:

### **Step 1: Enable Tasker HTTP Server**

1. Open **Tasker** app
2. Go to **☰ Menu** → **Preferences** → **Misc**
3. Enable **"Allow External Access"**
4. Enable **"WiFi Service"**
5. Note the port number (usually **1821**)
6. **IMPORTANT**: Set an HTTP Auth password for security
   - Tap "Set HTTP Server Password"
   - Choose a strong password
   - Save it

### **Step 2: Find Your Phone's Local IP**

1. Go to **Settings** → **WiFi**
2. Tap on your connected network
3. Note your **IP Address** (e.g., `192.168.1.XXX`)
4. Make sure your phone and server are on the **same WiFi network**

### **Step 3: Update Server Configuration**

Create environment file on server:

```bash
# Edit ~/.bashrc or create /home/ubuntu/vp/.env.alarm
export PHONE_IP="192.168.1.XXX"  # Your phone's IP
export PHONE_PORT="1821"          # Tasker HTTP port
export TASKER_AUTH="your_password_here"  # HTTP auth password
```

Then reload:
```bash
source ~/.bashrc
```

### **Step 4: Create Tasker Profile**

**Profile: "NYX Alarm Setter"**

1. **Event** → **Net** → **HTTP Request**
   - Port: `1821`
   - Path: `/nyx/alarm`
   - Method: `POST`

2. **Task: "Set Alarm from NYX"**

**Actions:**

```
1. Variable Set
   Name: %http_req_data
   To: %http_req

2. JavaScriptlet
   Code:
   try {
     var data = JSON.parse(http_req);
     var hour = data.hour || 0;
     var minute = data.minute || 0;
     var message = data.message || "NYX Alarm";

     // Store in Tasker variables
     setGlobal('NYX_ALARM_HOUR', hour);
     setGlobal('NYX_ALARM_MIN', minute);
     setGlobal('NYX_ALARM_MSG', message);
   } catch(e) {
     flash("Error parsing alarm: " + e);
   }

3. System → Set Alarm
   Hour: %NYX_ALARM_HOUR
   Minute: %NYX_ALARM_MIN
   Message: %NYX_ALARM_MSG
   Confirm: OFF (auto-set without confirmation)

4. Flash (optional for debugging)
   Text: "Alarm set for %NYX_ALARM_HOUR:%NYX_ALARM_MIN"

5. HTTP Response
   Code: 200
   Output: {"status":"success","alarm":"%NYX_ALARM_HOUR:%NYX_ALARM_MIN"}
```

### **Alternative: Simplified Version (No JavaScriptlet)**

If JavaScript doesn't work, use this simpler version:

```
1. Variable Search Replace
   Variable: %http_req
   Search: .*"hour":(\d+).*
   Store Result In: %alarm_hour

2. Variable Search Replace
   Variable: %http_req
   Search: .*"minute":(\d+).*
   Store Result In: %alarm_min

3. Variable Search Replace
   Variable: %http_req
   Search: .*"message":"([^"]+)".*
   Store Result In: %alarm_msg

4. System → Set Alarm
   Hour: %alarm_hour
   Minute: %alarm_min
   Message: %alarm_msg
   Confirm: OFF

5. HTTP Response
   Code: 200
   Output: OK
```

---

## 🧪 Testing

### **Step 1: Test Manually from Server**

```bash
# Test the command directly
node /home/ubuntu/vp/.scripts/nyx-set-alarm.mjs "7:30am" "Test alarm"

# You should see:
# ✅ Alarm set for 7:30 AM
# 📝 Test alarm
```

**Troubleshooting:**
- ❌ "Phone unreachable" → Check IP, WiFi, Tasker HTTP server running
- ❌ "HTTP 401" → Check TASKER_AUTH password
- ❌ "HTTP 404" → Check Tasker profile path is `/nyx/alarm`

### **Step 2: Test via Telegram**

Send to NYX:
```
Set alarm for 6am tomorrow
```

NYX should:
1. Detect alarm intent
2. Execute `nyx-set-alarm` command
3. Reply with confirmation: "✅ Alarm set for 6:00 AM on Mar 15"

---

## 🔒 Security Notes

1. **HTTP Auth**: Always set a password in Tasker HTTP server
2. **Local Network Only**: Tasker HTTP server only works on local WiFi (not internet)
3. **Firewall**: Phone firewall should allow incoming on port 1821 from local network
4. **VPN**: If using VPN on phone, it might block local connections

---

## 🎨 Advanced: Custom Alarm Sounds/Actions

In Tasker, after setting the alarm, you can add more actions:

```
6. Media → Play Ringtone
   Sound: Your favorite alarm sound
   Volume: 100%

7. Say
   Text: "Good morning, Sir. Time to wake up."
   Engine: Google TTS

8. AutoTools → Web Screen
   URL: http://your-server/api/nyx/morning-briefing
   (Show briefing on phone screen)
```

---

## 📊 Supported Time Formats

The system understands:

| Input | Parsed As |
|-------|-----------|
| "7am" | 07:00 |
| "7:30am" | 07:30 |
| "19:30" | 19:30 (7:30 PM) |
| "tomorrow at 6am" | 06:00 next day |
| "tonight at 9pm" | 21:00 today |
| "at 7" | 07:00 |
| "for 8:30" | 08:30 |

---

## 🐛 Debugging

**Check Tasker HTTP Server Status:**
1. Open Tasker
2. Go to **☰ Menu** → **Preferences** → **Misc**
3. Check "WiFi Service" is **enabled**
4. Check port number

**View Tasker Logs:**
1. In Tasker, enable **Run Log** (☰ Menu → Preferences → More → Run Log)
2. Trigger an alarm from Telegram
3. Check **Run Log** for errors

**Check Server Logs:**
```bash
pm2 logs pantheon-server --lines 50 | grep -i alarm
```

**Test HTTP Endpoint Manually:**
```bash
curl -X POST \
  -u :YOUR_PASSWORD_HERE \
  -H "Content-Type: application/json" \
  -d '{"hour":7,"minute":30,"message":"Test"}' \
  http://192.168.1.XXX:1821/nyx/alarm
```

---

## 🎯 Next Steps

1. ⏰ **Set up Tasker profile** (see Step 4 above)
2. 🔧 **Configure phone IP** in server environment
3. 🧪 **Test with simple alarm** via Telegram
4. 🎉 **Enjoy voice-controlled alarms!**

---

**Need help?** Check:
- Tasker logs for HTTP request errors
- Server logs: `pm2 logs pantheon-server`
- Test script directly: `nyx-set-alarm "7am" "test"`
