'==============================================
' 学升·智能刷题平台 启动器
' 双击本文件即可启动应用（无黑色控制台窗口）
'==============================================
Option Explicit
Dim ws, node, app
Set ws = CreateObject("WScript.Shell")
node = "C:\Users\23341\.workbuddy\binaries\node\versions\22.22.2\node.exe"
app = "C:\Users\23341\CodeBuddy\20260814175501\study-platform\launcher.js"
ws.Run """" & node & """ """ & app & """", 0, False
