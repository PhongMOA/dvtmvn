package vn.marvelvn.app;

import android.app.ActivityManager;
import android.content.Context;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Chế độ kiosk: ẩn thanh trạng thái + thanh điều hướng/taskbar và ghim ứng
 * dụng; exit() (nút "Thoát") gỡ cả hai. Vuốt mép màn hình thì thanh chỉ hiện
 * tạm rồi tự ẩn lại.
 * Gọi từ web qua registerPlugin("Immersive") — xem src/components/kiosk/kiosk.tsx.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {

    private boolean active = false;

    @PluginMethod
    public void enter(PluginCall call) {
        active = true;
        apply();
        call.resolve();
    }

    @PluginMethod
    public void exit(PluginCall call) {
        active = false;
        apply();
        call.resolve();
    }

    // Rời app rồi quay lại thì hệ thống hiện lại thanh -> ẩn lại nếu đang ở kiosk.
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (active) apply();
    }

    private void apply() {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            if (active) {
                controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars());
            }
            setPinned(active);
        });
    }

    // Ghim ứng dụng (screen pinning): khoá nút Home/Đa nhiệm, kéo thông báo,
    // taskbar. Lần đầu Android hỏi xác nhận; máy phải bật "Ghim ứng dụng" trong
    // Cài đặt. Không phải device owner nên không chặn được tuyệt đối.
    private void setPinned(boolean pin) {
        ActivityManager am =
            (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        boolean pinned = am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
        try {
            if (pin && !pinned) getActivity().startLockTask();
            else if (!pin && pinned) getActivity().stopLockTask();
        } catch (RuntimeException e) {
            // Máy tắt ghim ứng dụng / chính sách chặn -> chỉ còn ẩn thanh.
        }
    }
}
