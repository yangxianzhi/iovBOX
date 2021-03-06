//AMD define(media_dbus,[], () => {
    var dbus = require('dbus-native');
    //var conn = dbus.createConnection();
    const systemBus = dbus.systemBus();
    const serviceName = 'et.e52x.main';
    const media_dbus_name = 'et.e52x.media';
    const media_dbus_path= '/' + media_dbus_name.replace(/\./g, '/');
    var dbus_conf_json={
            'path': '/et/e52x/media',
            'destination': 'et.e52x.media',
            'interface': 'et.e52x.media',
            'member': 'media_config',
            'signature': 'u',
            'body': [0],
            'type': dbus.messageType.methodCall
    };
    
    var dbus_out_json={
            'path': '/et/e52x/media',
            'destination': 'et.e52x.media',
            'interface': 'et.e52x.media',
            'member': 'media_status',
            'type': dbus.messageType.methodCall
    };
    
    /**
     * request dbus main service.
     * register signals after main service requested.
     * 
     * @param {string} value  service name default as  et.e52x.main
     * @returns {Promise}  to keep sync and confirm request service runned before other interfaces.
     */
    function requestService(value)
    {
        var proc = new Promise((resolve, reject) => {
            systemBus.requestName(value, 0x4, (e, retCode) => {
            // Return code 0x1 means we successfully had the name
                if(retCode === 1) { 
                    systemBus.addMatch('type=\'signal\', member=\'status_update\'', (err, value) => {
                    try {
                        if(err) {
                            reject(err);
                        }
                        else{
                            resolve(value);
                        }
                    } catch(error) {
                            reject(error);
                    }
                    });
                }else{
                    reject(e);
                }
            });
        })
        return proc;
    }
    
    var proc = requestService(serviceName);
    
    function onStatusUpdate(inputCallBack)
    {
        var signalFullName = systemBus.mangle(media_dbus_path, media_dbus_name, 'status_update');
        systemBus.signals.on(signalFullName, (messageBody) => {
            var event={
                cam_count:messageBody[0][0]
            };
            if(event.cam_count != 0) {
                event.cam_list = [];
            }
            for (var i = 0; i < event.cam_count; ++i) {
                var camera = {
                    cam_index:messageBody[0][i+1][0],
                    push_status:messageBody[0][i+1][1],
                    push_code:messageBody[0][i+1][2],
                    record_status:messageBody[0][i+1][3],
                    record_code:messageBody[0][i+1][4]
                }
                event.cam_list[i] = camera;
            }
            return inputCallBack(event);
        });
    }

    /**
     * 
     * @param {object} cam_config
     * {
     *     cam_info:[
     *         {
     *             ipCam:'',
     *             path:''
     *         },
     *         {
     *             ipCam:'',
     *             path:''
     *         },
     *         {
     *             ipCam:'',
     *             path:''
     *         }
     *     ]
     * } 
     * @param {function} outputCallBack 
     */
    function initCam(cam_config, outputCallBack)
    {
        if (!cam_config.cam_info) {
            var event = {
                code:-1,
                message:'cam_info param error'
            }
            outputCallBack(event);
            return;
        }

        if (cam_config.cam_info.length == 0) {
            var event = {
                code:-1,
                message:'warring cam number 0'
            }
            outputCallBack(event);
            return;
        }

        proc.then(()=>{
            dbus_conf_json['member'] = 'media_init';
            var cnt = cam_config.cam_info.length;
            dbus_conf_json['signature'] = '(u';
            dbus_conf_json['body'] = [ [cnt] ];
            for( var i = 0; i < cnt; ++i ) {
                var ipCam = cam_config.cam_info[i].ipCam;
                var path = cam_config.cam_info[i].path;
                var param = [i+1, ipCam, 'play_out', ipCam, path, 'photo_in', 'photo_out'];
                dbus_conf_json['body'][0][i+1] = param;
                dbus_conf_json['signature'] += '(ussssss)';
            }
            dbus_conf_json['signature'] += ')'
            systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'media_init error!',
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'media_init success!',
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        }).catch((err)=>{
            var event = {
                code:-1,
                message:'media_init exceptions!',
                error:err
            }
            outputCallBack(event);
        });
        return;
    }

   
    function getCamInfo(outputCallBack)
    {
        proc.then(()=>{
            dbus_out_json['member']='media_status';
            systemBus.invoke(dbus_out_json, (err, messageBody) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'get media_status info error!',
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    //do something
                    var event={
                        code:0,
                        message:'get media_status info success!',
                        cam_count:messageBody[0]
                    };
                    if(event.cam_count != 0) {
                        event.cam_list = [];
                    }
                    for (var i = 0; i < event.cam_count; ++i) {
                        var camera = {
                            cam_index:messageBody[i+1][0],
                            push_status:messageBody[i+1][1],
                            push_code:messageBody[i+1][2],
                            record_status:messageBody[i+1][3],
                            record_code:messageBody[i+1][4]
                        }
                        event.cam_list[i] = camera;
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }
    
    function recordCam(id, url, path, period, loop, outputCallBack)
    {
        proc.then(()=>{
            dbus_conf_json['member'] = 'media_record';
            dbus_conf_json['signature'] = 'usssuu';
            dbus_conf_json['body']= [id,'start',`${url}`,`${path}`,period,loop];
            systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'start media_record fail!',
                        cam_index:id,
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'start media_record success!',
                        cam_index:id,
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }

    function stopRecord(id, outputCallBack)
    {
        proc.then(()=>{
            dbus_conf_json['member'] = 'media_record';
            dbus_conf_json['signature'] = 'us';
            dbus_conf_json['body']= [id, 'stop'];
           systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'stop media_record fail!',
                        cam_index:id,
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'stop media_record success!',
                        cam_index:id,
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }
    
    function playCam(id, url, path, time, outputCallBack)
    {
        proc.then(()=>{
            dbus_conf_json['member'] = 'media_stream';
            dbus_conf_json['signature'] = 'usssu';
            dbus_conf_json['body']= [id, 'start', `${url}`, `${path}`, time];
            systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'start media_stream fail!',
                        cam_index:id,
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'start media_stream success!',
                        cam_index:id,
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }
    
    function stopPlay(id, outputCallBack)
    {
        proc.then(()=>{
            dbus_conf_json['member'] = 'media_stream';
            dbus_conf_json['signature'] = 'us';
            dbus_conf_json['body']= [id, 'stop'];
            systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'stop media_stream fail!',
                        cam_index:id,
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'stop media_stream success!',
                        cam_index:id,
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }

    function captureCam(id, url, path, num, outputCallBack)
    {
        proc.then(()=>{
            dbus_conf_json['member'] = 'media_picture';
            dbus_conf_json['signature'] = 'usssu';
            dbus_conf_json['body']= [id, 'start', `${url}`, `${path}`, num];
            systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'media_picture fail!',
                        cam_index:id,
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'media_picture success!',
                        cam_index:id,
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }
    

    function playFile(path, url, time, outputCallBack)
    {
        proc.then(()=>{
            dbus_conf_json['member'] = 'media_file_stream';
            dbus_conf_json['signature'] = 'sssu';
            dbus_conf_json['body']= ['start', `${path}`, `${url}`, num];
            systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'media_file_stream fail!',
                        path:path,
                        url:url,
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'media_file_stream success!',
                        path:path,
                        url:url,
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }
    
    
    /**
     * set dial app debug level as level then debuged 
     * 
     * @param {uint} level 
     * @param {function} outputCallBack 
     * @returns 
     */
    function setDebugLevel(level, outputCallBack)
    {
        proc.then(()=>{
            dbus_conf_json['member'] = 'debug_level';
            dbus_conf_json['signature'] = 'u';
            dbus_conf_json['body']= [level];  
            systemBus.invoke(dbus_conf_json, (err, res) => {
                if(err)
                {
                    var event = {
                        code:-1,
                        message:'set debug level error !',
                        level:level,
                        error:err
                    }
                    outputCallBack(event);
                }else{
                    var event = {
                        code:0,
                        message:'set debug level success!',
                        level:level,
                        result:res
                    }
                    outputCallBack(event);
                }
            });
        });
        return;
    }
    
    module.exports.initCam = initCam;
    module.exports.getCamInfo = getCamInfo;
    module.exports.recordCam = recordCam;
    module.exports.stopRecord = stopRecord;
    module.exports.playCam = playCam;
    module.exports.stopPlay = stopPlay;
    module.exports.captureCam = captureCam;
    module.exports.playFile = playFile;
    module.exports.onStatusUpdate = onStatusUpdate;
    module.exports.setDebugLevel = setDebugLevel;
//}    
