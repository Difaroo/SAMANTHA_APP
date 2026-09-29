package com.samantha.voice;

import android.media.AudioDeviceInfo;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class VoiceAudioRoutePluginTest {
    @Test
    public void communicationRoutePrefersHeadsetsThenEarpieceAndNeverSpeaker() {
        assertEquals(0, VoiceAudioRoutePlugin.routePriority(AudioDeviceInfo.TYPE_BLUETOOTH_SCO));
        assertEquals(1, VoiceAudioRoutePlugin.routePriority(AudioDeviceInfo.TYPE_WIRED_HEADSET));
        assertEquals(2, VoiceAudioRoutePlugin.routePriority(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE));
        assertEquals(Integer.MAX_VALUE,
                VoiceAudioRoutePlugin.routePriority(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER));
    }
}
