# Interface

This document describes how the app interfaces with hardware devices, focusing on the primary path (Web MIDI API with SysEx), while briefly covering alternative interfaces available in the framework (WebUSB, Web Bluetooth Low Energy, Web Serial, WebHID), and the optional WebSocket bridge.

- Back to overview: [README](./README.md)
- How to run: [Running the Skin App](./running.md)
- 3D visualization: [Visualization](./visualization.md)
- Serial interface: [Interface - Serial](./interface-serial.md)

## Primary path: Web MIDI API (SysEx)

- Entry point: `packages/skin/index.js` creates `SkinDeviceProcessor`, `SkinDeviceIO`, and `FingerDeviceViewSDK`, then calls `skn_io.connect()`.
- `SkinDeviceIO` (`packages/framework/js/modules/sensors/skin/SkinDeviceIO.js`) uses `MIDIDevice` to communicate with the device.
- `MIDIDevice` (`packages/framework/js/modules/utilities/devices/MIDIDevice.js`):
  - Requests access with SysEx: `navigator.requestMIDIAccess({ sysex: true })`.
  - Binds input/output where the port names include `SkinDeviceAPI.name` ("Robotic Hand Sensor") or `SkinDeviceAPI.bootloader_name` ("RHS - Bootloader").
  - For state changes (connect/disconnect), triggers `prc.connected()` / `prc.disconnected()` to update UI and state.

### Message formats

Messages are primarily MIDI SysEx payloads defined in `SkinDeviceAPI` (`packages/framework/js/modules/sensors/skin/SkinDeviceAPI.js`). Important items:

- `SYX_SINGLE_PERIPHERAL_SENSOR_UPDATE_2` (10) — continuous sensor frames for finger mode; values packed as 7-bit pairs.
- `SYX_PERIPHERAL_FIRMWARE_VERSION_MSG_2` (11) — peripheral firmware/app version and board status.
- `SYX_FIRMWARE_VERSION_MSG` (0) — central firmware/app version.
- `SYX_WEB_APP_SETTINGS` (15) — bulk UI-config-to-device message.
- `SYX_BINARY_FILE_*` (17–20) — request and stream calibration files, then decompress with `brotli`.

`SkinDeviceProcessor.process()` decodes these packets, maintains sensor maps/buffers, handles taring, stats, and fires `full_frame_updated` to the UI.

## MIDI SysEx packets (structure and messages)

This app uses a consistent SysEx envelope for most messages. See `SkinDeviceAPI._get_*` helpers for exact byte layouts.

### Envelope layout

| Field | Bytes | Index | Description |
|---|---|---:|---|
| Start | `0xF0` | 0 | SysEx start |
| Vendor header | `0x00 0x01 0x5F 0x7A` | 1–4 | Manufacturer/device prefix |
| PID | `SkinDeviceAPI.PID` (e.g., `0x42`) | 5 | Product identifier |
| Group | `SYX_EDITOR_MESSAGE` (`0x01`) | 6 | Message group |
| LEN | length byte | 7 | Number of payload bytes that follow |
| TYPE | message type | 8 | `SYX_OUT_ARRAY_PAYLOAD_START` (type index) |
| PAYLOAD | type-specific | ≥9 | Data (often 7-bit pairs) |
| End | `0xF7` | last | SysEx end |

Notes:
- `TYPE` is read at index `8` (`SYX_OUT_ARRAY_PAYLOAD_START`).
- Payload begins at index `9`.

### Messages used by the app (excluding firmware update flows)

| Message | Code | Payload (summary) | Notes |
|---|---:|---|---|
| `SYX_SINGLE_PERIPHERAL_SENSOR_UPDATE_2` | 10 | 100 sensors as 7-bit pairs: `[ms7, ls7]` → `(ms7<<7)|ls7` (0..4095) | Scan order: inner `drive` 0..9, outer `sense` 0..9 → address `${drive}_${sense}` pre-remap. Updates `sensor_nodes`, computes stats, emits `full_frame_updated`. |
| `SYX_WEB_APP_SETTINGS` | 15 | Series of 14-bit values (7-bit pairs) + three booleans | See table below for field order and indices. |
| `SYX_SENSOR_TETHER_ON` | 16 | `start_stop_bool` (1 byte) | 1 = start streaming; 0 = stop. |
| `SYX_FIRMWARE_VERSION_MSG` | 0 | Version bytes | Central boot/app versions. |
| `SYX_PERIPHERAL_FIRMWARE_VERSION_MSG_2` | 11 | Board number, versions, board status | Used to set `sensor_connected` when status indicates Present in App. |
| `SYX_BINARY_FILE_REQUEST` | 18 | none | Initiates calibration file transfer (not firmware update). |
| `SYX_BINARY_FILE_SIZE_CHECKSUM` | 19 | size (3×7-bit), checksum (3×7-bit) | Reports file size and checksum. |
| `SYX_BINARY_FILE_CHUNK` | 20 | 16 values as 7-bit pairs + byte pointer | Streams calibration file contents in chunks. |

#### `SYX_WEB_APP_SETTINGS` (15) payload fields

| Field | Indices (payload) | Encoding | Description |
|---|---|---|---|
| `cal_offset_input` | 9–10 | 14-bit (two 7-bit) | Calibration offset |
| `bottom_row_mult` | 11–12 | 14-bit | Bottom-row multiplier |
| `AT_SUM_THRESH_BOX` | 13–14 | 14-bit | Auto-tare sum threshold |
| `AT_NEG_DELT_THRESH_BOX` | 15–16 | 14-bit (signed) | Auto-tare negative delta threshold |
| `AT_NEG_DELT_STEADY_BOX` | 17–18 | 14-bit (signed) | Auto-tare negative steady window |
| `AT_POS_DELT_STEADY_BOX` | 19–20 | 14-bit | Auto-tare positive steady window |
| `AT_STEADY_FRAME_BOX` | 21–22 | 14-bit | Auto-tare steady frames |
| `RT_ABS_DELTA_BOX` | 23–24 | 14-bit | Running-tare abs delta max |
| `RT_SENSOR_SUM_BOX` | 25–26 | 14-bit | Running-tare sensor sum max |
| `RT_SAMPLE_FRAME_BOX` | 27–28 | 14-bit | Running-tare sample frame |
| `RT_TARE_FRAME_BOX` | 29–30 | 14-bit | Running-tare tare frame |
| `ground_unused_sense_lines` | 31 | 8-bit bool | Ground unused sense lines |
| `send_crosstalk_canceled_data` | 32 | 8-bit bool | Output crosstalk-canceled data |
| `drive_senselines_for_all_high` | 33 | 8-bit bool | Drive all sense lines |

### Handshake to enable streaming (MIDI + SysEx)

- **Connect:** `MIDIDevice` detects the target MIDI I/O (port name contains `Robotic Hand Sensor` or `RHS - Bootloader`) and triggers `prc.connected()`.
- **Initial CC requests (non‑SysEx):** sent by `FingerDeviceViewSDK` on connect
  - Device info: `[176, 0, 0]` (`get_device_info_message()`)
  - Web app settings request: `[176, 7, 0]` (`get_device_web_apps_info_message()`)
- **Calibration file request loop (1 Hz):** until a calibration transfer completes
  - Host sends `SYX_BINARY_FILE_REQUEST` (TYPE=18)
  - Device must respond with:
    - `SYX_BINARY_FILE_SIZE_CHECKSUM` (TYPE=19)
    - at least one `SYX_BINARY_FILE_CHUNK` (TYPE=20)
  - Note: A zero‑length file is valid. Send size=0 in TYPE=19 and still send one TYPE=20 chunk; the host will consider the transfer complete.
- **Unlock streaming:** upon transfer completion the host sends `SYX_SENSOR_TETHER_ON` (TYPE=16, `start_stop_bool=1`). After this, continuous sensor frames (TYPE=10) are displayed.
- **Optional status UX:** if the device also emits `SYX_PERIPHERAL_FIRMWARE_VERSION_MSG_2` (TYPE=11) with board status “Present In App,” the UI shows Sensor: Connected.

All SysEx messages follow the envelope above; the host reads the message TYPE at index 8 (`SYX_OUT_ARRAY_PAYLOAD_START`) and payload begins at index 9.

#### Non‑SysEx control change messages (on connect)

```text
// Channel 1 CC (decimal shown)
[176, 0, 0]  // device info query
[176, 7, 0]  // web app settings query
```

#### Calibration file transfer: payload details

- **`SYX_BINARY_FILE_SIZE_CHECKSUM` (TYPE=19)**
  - Size (3×7‑bit): `size = s0 + (s1 << 7) + (s2 << 14)`
  - Checksum (3×7‑bit): `checksum = c0 + (c1 << 7) + (c2 << 14)`

- **`SYX_BINARY_FILE_CHUNK` (TYPE=20)**
  - Pointer MSB (2×7‑bit): `pointer_msb = ph0 + (ph1 << 7)`
  - Pointer LSB (2×7‑bit): `pointer_lsb = pl0 + (pl1 << 7)`
  - Absolute pointer (16‑bit): `byte_pointer = (pointer_msb << 8) + pointer_lsb`
  - 16 data bytes, each as 2×7‑bit pairs: `byte_i = d0 + (d1 << 7)` for i=0..15
  - Transfer complete condition: when `byte_pointer >= file_size` after writing the last byte; host logs completion and immediately sends `SYX_SENSOR_TETHER_ON` (TYPE=16, `1`).

#### Streaming frames: `SYX_SINGLE_PERIPHERAL_SENSOR_UPDATE_2` (TYPE=10)

- Values encoded as 14‑bit using 7‑bit pairs: `val = (ms7 << 7) + ls7` clamped to ADC max (4095).
- Expected scan order (finger build):
  - Inner loop: `drive` 0..9; then reset `drive=0` and increment `sense`.
  - Effective address before remap: `${drive}_${sense}`. The processor remaps certain addresses and updates `sensor_nodes`, then emits `full_frame_updated` for the UI (3D and grid).

### Browser requirements

- Chrome or Edge with MIDI/SysEx permissions enabled for the dev URL. Docs: https://developer.chrome.com/articles/webmidi/
- On connect, Chrome/Edge will prompt to allow access to MIDI devices; ensure SysEx is allowed.

## Optional: WebSocket bridge

Enabled by setting `WEBSOCKETS=true` at run time and/or using the UI toggle in `FingerDeviceViewSDK`:

- In `packages/framework/js/modules/sensors/skin/FingerDeviceViewSDK.js`:
  - `open_websock(port)` connects to `ws://localhost:<port>` (default 8080).
  - On each frame, if `enable_websocket` is true, it sends a JSON packet containing processed/raw maps, tare offsets, flags, and sums.
- Sample server: `packages/sdk/Skin/PythonSampleSkin/websocket_server_robotic_skin.py`
  - Starts a server on `localhost:8080` and shows how to receive packets and send commands (e.g., `TARE_SENSORS`).
  - Uses `websockets` and `readchar`. Adjust to your needs.

## Alternative interfaces available in the framework

These modules are included under `packages/framework/js/modules/utilities/devices/`. The skin app path uses MIDI, but these illustrate support for other transports.

- **WebUSB** (example UI: `USBDeviceUi.js`)
  - Uses the WebUSB API (`navigator.usb`) to request and communicate with USB devices.
  - Includes firmware update flow and IO loop management for Electron and browser contexts.
  - Docs: https://developer.mozilla.org/docs/Web/API/USB

- **Web Bluetooth Low Energy** — `BLEDevice.js`
  - Requests device with `navigator.bluetooth.requestDevice(...)` and subscribes to notifications on a characteristic.
  - Queues writes with `writeValueWithoutResponse` and re-connects on transient errors.
  - Docs: https://web.dev/bluetooth/

- **Web Serial** — `SerialDevice.js`
  - Requests a serial port with `navigator.serial.requestPort({ filters })`, opens at 115200 baud, and uses `readable/writable` streams.
  - Supports raw writes and encoded (text) writes with optional delays.
  - Docs: https://developer.mozilla.org/docs/Web/API/Serial

- **WebHID** — `HIDDevice.js`
  - Requests a HID device with `navigator.hid.requestDevice({ filters })`, listens to `inputreport`, and writes via `sendReport`.
  - Monitors connect/disconnect for cleanup.
  - Docs: https://developer.chrome.com/docs/capabilities/web-apis/hid/

### Browser support caveats

- WebUSB, Web Bluetooth, Web Serial, and WebHID are Chromium-focused and may require flags or HTTPS contexts depending on the API.
- Capabilities vary by platform/driver. For production use, verify permissions, HTTPS requirements, and device filters.

## Electron (note)

Electron support is indicated in scripts but the `packages/skin/electron-build/` directory is not present in this snapshot. Some device UIs (e.g., `USBDeviceUi`) contain Electron IPC usage for native USB. Those code paths are not active in the browser build but are useful for desktop builds when Electron packaging is configured.

## Extending the interface

- To add a new transport, create a device adapter modeled after `MIDIDevice`/`BLEDevice`/`SerialDevice`/`HIDDevice` and integrate it with a simple IO wrapper like `SkinDeviceIO` (swap which device class is instantiated).
- Update the UI to provide a connect button and status, following patterns in `USBDeviceUi.js` or the existing MIDI path.
- Ensure message formats are defined in or compatible with `SkinDeviceAPI`.
