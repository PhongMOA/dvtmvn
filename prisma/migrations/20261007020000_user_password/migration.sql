-- Đăng ký tài khoản thủ công bằng email + mật khẩu
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
