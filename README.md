<div align="center">

<img width="" src="icon.png"  width=120 height=120  align="center">

# 17PLUS

### 闵智作业平台增强插件

</div>

## 界面优化

- 加入部分动画效果
- 加入背景模糊效果
- 去除互动课堂的 Zingo AI 悬窗
- 去除非Chrome浏览器的Toast

## 功能优化

~~以下功能不要让老师知道~~

- 自定义点名名单

## 使用方法

下载[Release](https://github.com/SatinAu-Zelynn/17PLUS/releases)中的17PLUS.crx和allow-extension.bat，先打开浏览器chrome://extensions或edge://extensions中的开发人员模式，运行下载的allow-extension.bat，然后将17PLUS.crx拖入浏览器的扩展程序页面即可使用。


在扩展页面删除扩展后需要在 **终端（管理员）** 中运行以下命令，删除注册表中的白名单
```
reg delete HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallAllowlist /f
reg delete HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallAllowlist /f
```

<div align="right">
<table><td>
<a href="#17PLUS">👆 返回顶部</a>
</td></table>
</div>