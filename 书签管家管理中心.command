#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "======================================"
echo "    智能书签管家 - 服务管理中心"
echo "======================================"
echo "注意：核心服务已经注入 Mac 开机自启动，你其实完全不需要理会它。"
echo "这个脚本仅用于你需要调试或重启时使用。"
echo "--------------------------------------"
echo "1) 查看服务状态"
echo "2) 彻底停止后台服务"
echo "3) 重启后台服务 (并打开主页)"
echo "4) 实时查看运行日志"
echo "5) 打开主页"
echo "q) 退出"
echo "--------------------------------------"
read -p "请选择操作 [1/2/3/4/5/q]: " choice

case $choice in
    1)
        if launchctl list | grep -q "com.chaser.markai"; then
            echo "🟢 状态: 书签管家正在后台稳定运行！(PID: $(launchctl list | grep com.chaser.markai | awk '{print $1}'))"
        else
            echo "🔴 状态: 书签管家未运行。"
        fi
        ;;
    2)
        echo "⏳ 正在停止服务..."
        launchctl unload ~/Library/LaunchAgents/com.chaser.markai.plist 2>/dev/null
        echo "✅ 服务已完全卸载并停止。"
        ;;
    3)
        echo "⏳ 正在重启服务..."
        launchctl unload ~/Library/LaunchAgents/com.chaser.markai.plist 2>/dev/null
        launchctl load ~/Library/LaunchAgents/com.chaser.markai.plist
        echo "✅ 服务已加载！正在后台启动..."
        sleep 3
        open "http://localhost:3999"
        ;;
    4)
        echo "👀 实时查看日志 (按 Ctrl+C 退出):"
        tail -f "$DIR/markai.log"
        ;;
    5)
        open "http://localhost:3999"
        ;;
    q|Q)
        echo "退出。"
        exit 0
        ;;
    *)
        echo "❌ 无效的选择。"
        ;;
esac
