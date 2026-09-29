package com.samantha.voice;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int RECORD_AUDIO_PERMISSION_REQUEST = 1701;
    private PermissionRequest pendingAudioRequest;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VoiceAudioRoutePlugin.class);
        super.onCreate(savedInstanceState);

        this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public void onPermissionRequestCanceled(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (pendingAudioRequest == request) {
                        pendingAudioRequest = null;
                    }
                });
            }
        });
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        boolean requestsAudio = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                requestsAudio = true;
                break;
            }
        }

        if (!requestsAudio) {
            request.deny();
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            return;
        }

        if (pendingAudioRequest != null) {
            pendingAudioRequest.deny();
        }
        pendingAudioRequest = request;
        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.RECORD_AUDIO},
                RECORD_AUDIO_PERMISSION_REQUEST
        );
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != RECORD_AUDIO_PERMISSION_REQUEST) {
            return;
        }

        PermissionRequest request = pendingAudioRequest;
        pendingAudioRequest = null;
        if (request == null) {
            return;
        }

        boolean granted = grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            request.deny();
        }
    }
}
