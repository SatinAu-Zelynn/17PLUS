(function() {
    console.log('[17PLUS] Hook injected (Targeted Mode).');

    // 获取自定义名单
    function getCustomList() {
        try {
            const raw = localStorage.getItem('17PLUS_CUSTOM_LIST');
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    // 是否开启
    function isEnabled() {
        return localStorage.getItem('17PLUS_ENABLE_CUSTOM') === 'true';
    }

    const originalXHR = window.XMLHttpRequest;
    const originalOpen = originalXHR.prototype.open;
    const originalSend = originalXHR.prototype.send;

    // 拦截 Open 获取 URL
    originalXHR.prototype.open = function(method, url) {
        this._url = url; 
        return originalOpen.apply(this, arguments);
    };

    // 拦截 Send 修改数据
    originalXHR.prototype.send = function(body) {
        // 只有开启且有名单时才监听
        if (isEnabled() && getCustomList()) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4) {
                    const url = this._url;
                    const customList = getCustomList();

                    // === 基础配置接口 (包含 studentList) ===
                    if (url.includes('queryConfigData.vpage')) {
                        console.log('[17PLUS] 拦截到配置接口:', url);
                        try {
                            const json = JSON.parse(this.responseText);
                            
                            // 确保路径存在: data -> classList
                            if (json.data && json.data.classList && Array.isArray(json.data.classList)) {
                                // 遍历所有班级，替换名单
                                json.data.classList.forEach(cls => {
                                    // 根据自定义名单生成新的 studentList 结构
                                    cls.studentList = customList.map((name, index) => ({
                                        stuId: 990000 + index, // 生成伪造 ID
                                        studentNumber: "C" + (20240000 + index),
                                        stuName: name // 核心修改：名字
                                    }));
                                    cls.allHaveStuNumber = 1; // 确保数据一致性
                                });

                                // 覆写响应
                                overrideResponse(this, json);
                            }
                        } catch (e) { console.error('[17PLUS] Config patch failed', e); }
                    }

                    // === 奖励/积分接口 (点名器可能用这个列表) ===
                    else if (url.includes('queryTodayMultiClassReward.vpage')) {
                        console.log('[17PLUS] 拦截到奖励接口:', url);
                        try {
                            const json = JSON.parse(this.responseText);
                            
                            // 结构: data 是一个数组
                            if (json.data && Array.isArray(json.data)) {
                                json.data.forEach(cls => {
                                    // 默认头像地址（从您提供的数据中提取）
                                    const defaultAvatar = "https://cdn-jiaoxue.17zuoye.cn/jiaoxue-point-matrix-pen/icon/avator_default.png";
                                    
                                    // 替换 list
                                    cls.list = customList.map((name, index) => ({
                                        studentId: 990000 + index,
                                        score: 0,
                                        isDefaultAvatorImg: 1,
                                        studentName: name, // 核心修改：名字
                                        avatorUrl: defaultAvatar
                                    }));
                                });

                                // 覆写响应
                                overrideResponse(this, json);
                            }
                        } catch (e) { console.error('[17PLUS] Reward patch failed', e); }
                    }
                }
            });
        }
        return originalSend.apply(this, arguments);
    };

    // 覆写 XHR 响应
    function overrideResponse(xhr, json) {
        const newText = JSON.stringify(json);
        Object.defineProperty(xhr, 'responseText', { value: newText });
        Object.defineProperty(xhr, 'response', { value: newText });
        console.log('[17PLUS] 名单替换成功！当前人数:', getCustomList().length);
    }
})();