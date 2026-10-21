package vn.marvelvn.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin nội bộ phải đăng ký trước super.onCreate.
        registerPlugin(ImmersivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
