# ESP32-S3 USB CDC + Web Serial Notes

This note captures why the setup can work reliably with STM32 VCP yet appear to hang or disconnect with ESP32-S3 ROM USB CDC / USB Serial/JTAG when used from the browser (Chrome Web Serial).

## Summary

- **ESP32-S3 CDC can disappear or stall** under normal conditions (sleep modes, line-state changes, CPU halted, pin/stack reconfig). STM32 VCP is generally more robust to these scenarios.
- **DTR/RTS matters**: Browser clients do not assert DTR by default. If firmware expects `DTR=1` to proceed, it can look hung until DTR is set.
- **Buffering quirks**: In some cases, host-side buffering flushes on newline; missing newlines can make output appear stuck.
- **Host/OS interference**: Linux services (e.g., ModemManager, brltty) may open/toggle CDC ports briefly, affecting line states and stability.

## Project’s current behavior (for context)

- No init bytes sent on open: see `lib/serial/WebSerialTransport.js` and `lib/serial/SerialClient.js`.
- No DTR/RTS toggling on open; no `port.setSignals(...)` usage.
- Disconnects are surfaced via events; there’s no auto-reopen.

## Why STM32 VCP works while ESP32-S3 may hang

- **Maturity/robustness**: STM32 VCP stacks are stable and keep CDC alive across app states.
- **Line-state expectations**: ESP32 firmware may gate console/run on DTR. Browsers won’t assert DTR unless asked.
- **Power mgmt & clocks**: ESP32-S3 CDC depends on clocks/power domains; sleep/light-sleep can suspend responsiveness.
- **Control-line sensitivity**: DTR/RTS sequences can cause reset/bootloader entry or odd states.
- **Buffering**: ESP-IDF notes data may appear stuck until newline/extra data is sent.

## Known ESP32-S3 behaviors that cause shutdown/reopen

- **Sleep modes**
  - Deep-sleep: device disconnects; reconnects after wake.
  - Light-sleep: device becomes unresponsive; host may show disconnect/error; may not re-enumerate cleanly after wake.
- **USB pin/peripheral reconfig**: Reconfiguring USB pins or disabling CDC makes the device disappear.
- **CPU halted/breakpoints**: USB interrupts aren’t serviced; host disconnects after a short timeout.
- **Bootloader transitions/resets via line state**: DTR/RTS toggles can reset or enter download mode; repeated DTR activations have triggered stalls in reports.
- **ROM CDC vs TinyUSB conflicts**: Switching stacks or mismatched descriptors can break CDC.

## DTR/RTS and Chrome Web Serial

- Browsers don’t assert DTR automatically. Use `SerialPort.setSignals` after `open()` if firmware needs DTR high.

```js
await port.setSignals({ dataTerminalReady: true, requestToSend: true });
```

- If firmware has Arduino-style `while (!Serial)` or gates IO on DTR, asserting DTR is required to unblock.

## Buffering/flush quirks

- ESP-IDF notes rare cases where device→host data gets stuck until more data/newline is sent; default non-blocking drivers auto-flush after newline.

## Host/OS interference (Linux examples)

- Services like ModemManager or brltty can briefly claim `/dev/ttyACM*` and toggle line states; disable to rule this out during testing.

## Implications for a Web Serial client

- **Handle disconnect/re-enumeration**: Treat read end/`disconnect` events as recoverable and offer reconnect.
- **Optionally set signals**: If device requires it, set `DTR` (and possibly `RTS`) after open.
- **Avoid long blocking in firmware**: Keep USB tasks/ISRs serviced; avoid halting CPU while connected.
- **Avoid sleep while connected**: Disable auto light-sleep or use IDF options that prevent sleep when connected.
- **Ensure newline on output**: Helps host flush data promptly.
- **Don’t reconfigure USB pins while active**; avoid stack switching at runtime.

## Suggested experiments (to validate root cause)

- **DTR test**: Open via Web Serial without setting DTR; then call `setSignals({ dataTerminalReady: true })` and re-test IO.
- **Sleep gating**: Disable power management/light-sleep while using CDC; check stability.
- **Stress USB servicing**: Ensure firmware yields; observe if disconnects stop.
- **Host services**: Temporarily disable ModemManager/brltty and retest.
- **Re-enumeration observation**: Watch if the device path disappears/reappears on failure.

## References

- ESP-IDF: USB Serial/JTAG Console (Limitations: pin reconfig, buffering, sleep)
  - https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/usb-serial-jtag-console.html
- ESP-IDF: USB OTG Console (ROM CDC; limitations and fragility)
  - https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/usb-otg-console.html
- esptool: Boot mode selection and resets via DTR/RTS
  - https://docs.espressif.com/projects/esptool/en/latest/esp32s3/advanced-topics/boot-mode-selection.html
  - https://docs.espressif.com/projects/esptool/en/latest/esp32s3/esptool/advanced-options.html
- Web Serial control lines (DTR/RTS)
  - https://developer.mozilla.org/en-US/docs/Web/API/SerialPort/setSignals
- Community reports (examples)
  - ESP32-S3 stalls on second DTR activation: https://github.com/espressif/arduino-esp32/issues/9582
  - ESP32-S3 CDC inconsistent across hosts: https://github.com/espressif/arduino-esp32/issues/9580
