package com.samantha.voice;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

/**
 * Owns the native Android audio session while the LiveKit voice room is active.
 *
 * The web LiveKit client cannot select Android's communication audio mode by
 * itself. VoiceBridge prod uses LiveKit's native communication preset, which
 * prefers Bluetooth/wired communication devices and otherwise uses the built-in
 * earpiece. This plugin gives the Capacitor client the same route contract and
 * restores the user's prior audio state on disconnect.
 */
@CapacitorPlugin(name = "VoiceAudioRoute")
public class VoiceAudioRoutePlugin extends Plugin {
    private AudioManager audioManager;
    private boolean active;
    private int previousMode = AudioManager.MODE_NORMAL;
    private boolean previousSpeakerphoneOn;
    private Integer previousCommunicationDeviceId;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public synchronized void start(PluginCall call) {
        if (audioManager == null) {
            call.reject("Android audio service is unavailable");
            return;
        }

        if (!active) {
            previousMode = audioManager.getMode();
            previousSpeakerphoneOn = audioManager.isSpeakerphoneOn();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo previousDevice = audioManager.getCommunicationDevice();
                previousCommunicationDeviceId = previousDevice == null ? null : previousDevice.getId();
            }
            active = true;
        }

        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        AudioDeviceInfo selectedDevice = null;
        boolean routeSelected = false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            selectedDevice = selectCommunicationDevice(audioManager.getAvailableCommunicationDevices());
            if (selectedDevice != null) {
                routeSelected = audioManager.setCommunicationDevice(selectedDevice);
            }
        }

        // Pre-Android 12 fallback, and a defensive fallback if a vendor rejects
        // setCommunicationDevice. Communication mode + speaker off resolves to
        // an attached headset or the built-in earpiece.
        if (!routeSelected) {
            audioManager.setSpeakerphoneOn(false);
        }

        JSObject result = new JSObject();
        result.put("route", routeName(selectedDevice));
        result.put("communicationMode", audioManager.getMode() == AudioManager.MODE_IN_COMMUNICATION);
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void stop(PluginCall call) {
        restoreAudioState();
        call.resolve();
    }

    @Override
    protected synchronized void handleOnDestroy() {
        restoreAudioState();
    }

    private void restoreAudioState() {
        if (!active || audioManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audioManager.clearCommunicationDevice();
            AudioDeviceInfo previousDevice = findDeviceById(
                    audioManager.getAvailableCommunicationDevices(),
                    previousCommunicationDeviceId
            );
            if (previousDevice != null) {
                audioManager.setCommunicationDevice(previousDevice);
            }
        }
        audioManager.setSpeakerphoneOn(previousSpeakerphoneOn);
        audioManager.setMode(previousMode);
        previousCommunicationDeviceId = null;
        active = false;
    }

    static AudioDeviceInfo selectCommunicationDevice(List<AudioDeviceInfo> devices) {
        AudioDeviceInfo best = null;
        int bestPriority = Integer.MAX_VALUE;
        for (AudioDeviceInfo device : devices) {
            int priority = routePriority(device.getType());
            if (priority < bestPriority) {
                best = device;
                bestPriority = priority;
            }
        }
        return bestPriority == Integer.MAX_VALUE ? null : best;
    }

    static int routePriority(int type) {
        if (type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && type == AudioDeviceInfo.TYPE_BLE_HEADSET)
                || type == AudioDeviceInfo.TYPE_HEARING_AID) {
            return 0;
        }
        if (type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                || type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                || type == AudioDeviceInfo.TYPE_USB_HEADSET) {
            return 1;
        }
        if (type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
            return 2;
        }
        return Integer.MAX_VALUE;
    }

    private static AudioDeviceInfo findDeviceById(List<AudioDeviceInfo> devices, Integer id) {
        if (id == null) return null;
        for (AudioDeviceInfo device : devices) {
            if (device.getId() == id) return device;
        }
        return null;
    }

    private static String routeName(AudioDeviceInfo device) {
        if (device == null) return "communication-default";
        switch (device.getType()) {
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                return "bluetooth";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
                return "headset";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:
                return "earpiece";
            default:
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        && device.getType() == AudioDeviceInfo.TYPE_BLE_HEADSET) {
                    return "bluetooth";
                }
                return "communication-device";
        }
    }
}
