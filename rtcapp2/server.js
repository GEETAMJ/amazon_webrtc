// requires
const express = require('express');
const app = express();
const fs = require('fs');
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };
var https = require('https').Server(options,app);
var io = require('socket.io')(https);
var kurento = require('kurento-client');
var minimist = require('minimist');
var globalRecorder=null;
// variables
var kurentoClient = null;
var iceCandidateQueues = {};
var roomName;
// constantsf
// var argv = minimist(process.argv.slice(2), {
//     default: {
//         as_uri: 'http://localhost:3000/',
//         ws_uri: 'ws://localhost:8888/kurento'
//     }
// });
var argv = minimist(process.argv.slice(2), {
    default: {
        as_uri: 'http://localhost:3000/',
        ws_uri: 'ws://3.19.26.110:8888/kurento'
    }
});
function getopts(args, opts)
{
  var result = opts.default || {};
  args.replace(
      new RegExp("([^?=&]+)(=([^&]*))?", "g"),
      function($0, $1, $2, $3) { result[$1] = decodeURI($3); });

  return result;
};

// var argv = getopts(location.search,
// {
//   default:
//   {
//     // Non-secure WebSocket
//     // Only valid for localhost access! Browsers won't allow using this for
//     // URLs that are not localhost. Also, this matches the default KMS config:
//     //ws_uri: "ws://" + location.hostname + ":8888/kurento",

//     // Secure WebSocket
//     // Valid for localhost and remote access. To use this, you have to edit the
//     // KMS settings file "kurento.conf.json", and configure the section
//     // "mediaServer.net.websocket.secure". Check the docs:
//     // https://doc-kurento.readthedocs.io/en/latest/features/security.html#features-security-kms-wss
//     ws_uri: "wss://" + location.hostname + ":8433/kurento",

//     file_uri: 'file:///tmp/recorder_demo.webm', // file to be stored in media server
//     ice_servers: undefined
//   }
// });


////////
var args = 
      {
        // Non-secure WebSocket
        // Only valid for localhost access! Browsers won't allow using this for
        // URLs that are not localhost. Also, this matches the default KMS config:
        //ws_uri: "ws://" + location.hostname + ":8888/kurento",
    
        // Secure WebSocket
        // Valid for localhost and remote access. To use this, you have to edit the
        // KMS settings file "kurento.conf.json", and configure the section
        // "mediaServer.net.websocket.secure". Check the docs:
        // https://doc-kurento.readthedocs.io/en/latest/features/security.html#features-security-kms-wss
        //ws_uri: "wss://" + location.hostname + ":8433/kurento",
    
        file_uri: 'file:///tmp/geetam.webm', // file to be stored in media server
        ice_servers: undefined
      }
    
//////////

// express routing
app.use(express.static('public'))

// signaling
io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('disconnect', function(){
        removeUser(socket);
    });
    socket.on('message', function (message) {
        console.log('Message received: ', message.event);

        switch (message.event) {
            case 'joinRoom':
                joinRoom(socket, message.userName, message.roomName, err => {
                    if (err) {
                        console.log(err);
                    }
                });
                break;

            case 'receiveVideoFrom':
                receiveVideoFrom(socket, message.userid, message.roomName, message.sdpOffer, err => {
                    if (err) {
                        console.log(err);
                    }
                });
                break;

            case 'candidate':
                addIceCandidate(socket, message.userid, message.roomName, message.candidate, err => {
                    if (err) {
                        console.log(err);
                    }
                });
                break;
            case 'record':
                recordVideoOf(socket, message.userid, message.roomName, message.sdpOffer,err => {
                    if(err){
                        console.log(err);
                    }
                });

        }

    });
});

// signaling functions
function joinRoom(socket, username, roomname, callback) {
    getRoom(socket, roomname, (err, myRoom) => {
        roomName = roomname;
        if (err) {
            return callback(err);
        }
        var elements =
        [
        //   {type: 'RecorderEndpoint', params: {uri : args.file_uri}},
        //   {type: 'WebRtcEndpoint', params: {}}
        {type: 'RecorderEndpoint', params: {uri : 'file:///tmp/'+username+'.webm'}},
          {type: 'WebRtcEndpoint', params: {}}
        ]
        myRoom.pipeline.create(elements , (err, elements) => {
            if (err) {
                return callback(err);
            }
            var recorder = elements[0];
            var outgoingMedia = elements[1];



            var user = {
                id: socket.id,
                name: username,
                outgoingMedia: outgoingMedia,
                incomingMedia: {}
            }

            let iceCandidateQueue = iceCandidateQueues[user.id];
            if (iceCandidateQueue) {
                while (iceCandidateQueue.length) {
                    let ice = iceCandidateQueue.shift();
                    console.error(`user: ${user.name} collect candidate for outgoing media`);
                    user.outgoingMedia.addIceCandidate(ice.candidate);
                }
            }

            user.outgoingMedia.on('OnIceCandidate', event => {
                let candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                socket.emit('message', {
                    event: 'candidate',
                    userid: user.id,
                    candidate: candidate
                });
            });

            socket.to(roomname).emit('message', {
                event: 'newParticipantArrived', 
                userid: user.id,
                username: user.name
            });

            let existingUsers = [];
            for (let i in myRoom.participants) {
                if (myRoom.participants[i].id != user.id) {
                    existingUsers.push({
                        id: myRoom.participants[i].id,
                        name: myRoom.participants[i].name
                    });
                }
            }
            socket.emit('message', {
                event: 'existingParticipants', 
                existingUsers: existingUsers,
                userid: user.id
            });
            console.log("999");
            getKurentoClient((error, kurento) => {
                kurento.connect(outgoingMedia,recorder,function(err){
                    console.log("connected for recording");
                    globalRecorder=recorder;
                    startRecording(recorder,err => {
                        if (err){
                            console.log(error);
                        }
                    });
                    // var startRecordButton = document.getElementById('record');
                    // startRecordButton.addEventListener('click',startRecording(recorder,err => {
                    //     if (err) {
                    //         console.log(err);
                    //     }
                    // }));
                });
            
            })

            myRoom.participants[user.id] = user;
        });
    });
}
function startRecording(myrecorder,callback){
    myrecorder.record(function(err){
        if (err) return callback(err);
        console.log("recording on");
        // var stopRecordButton = document.getElementById('stop');
        // stopRecordButton.addEventListener("click", function(event){
        //     recorder.stop();
        //     // pipeline.release();
        //     // webRtcPeer.dispose();
        //     // videoInput.src = "";
        //     // videoOutput.src = "";

        //     // hideSpinner(videoInput, videoOutput);

        //     // var playButton = document.getElementById('play');
        //     // playButton.addEventListener('click', startPlaying);
        //   })

    })
}
function receiveVideoFrom(socket, userid, roomname, sdpOffer, callback) {
    console.log("hooray")
    getEndpointForUser(socket, roomname, userid, (err, endpoint) => {
        if (err) {
            return callback(err);
        }

        endpoint.processOffer(sdpOffer, (err, sdpAnswer) => {
            if (err) {
                return callback(err);
            }

            socket.emit('message', {
                event: 'receiveVideoAnswer',
                senderid: userid,
                sdpAnswer: sdpAnswer
            });

            endpoint.gatherCandidates(err => {
                if (err) {
                    return callback(err);
                }
            });
        });
    })
}

function addIceCandidate(socket, senderid, roomname, iceCandidate, callback) {
    let user = io.sockets.adapter.rooms[roomname].participants[socket.id];
    if (user != null) {
        let candidate = kurento.register.complexTypes.IceCandidate(iceCandidate);
        if (senderid == user.id) {
            if (user.outgoingMedia) {
                user.outgoingMedia.addIceCandidate(candidate);
            } else {
                iceCandidateQueues[user.id].push({candidate: candidate});
            }
        } else {
            if (user.incomingMedia[senderid]) {
                user.incomingMedia[senderid].addIceCandidate(candidate);
            } else {
                if (!iceCandidateQueues[senderid]) {
                    iceCandidateQueues[senderid] = [];
                }
                iceCandidateQueues[senderid].push({candidate: candidate});
            }   
        }
        callback(null);
    } else {
        callback(new Error("addIceCandidate failed"));
    }
}

// useful functions
function getRoom(socket, roomname, callback) {
    var myRoom = io.sockets.adapter.rooms[roomname] || { length: 0 };
    var numClients = myRoom.length;

    console.log(roomname, ' has ', numClients, ' clients');

    if (numClients == 0) {
        socket.join(roomname, () => {
            myRoom = io.sockets.adapter.rooms[roomname];
            getKurentoClient((error, kurento) => {
                kurento.create('MediaPipeline', (err, pipeline) => {
                    if (error) {
                        return callback(err);
                    }

                    myRoom.pipeline = pipeline;
                    myRoom.participants = {};
                    callback(null, myRoom);
                });
            });
        });
    } else {
        socket.join(roomname);
        callback(null, myRoom);
    }
}

function getEndpointForUser(socket, roomname, senderid, callback) {
    console.log("hooray1")
    var myRoom = io.sockets.adapter.rooms[roomname];
    var asker = myRoom.participants[socket.id];
    var sender = myRoom.participants[senderid];

    if (asker.id === sender.id) {
        return callback(null, asker.outgoingMedia);
    }

    if (asker.incomingMedia[sender.id]) {
        sender.outgoingMedia.connect(asker.incomingMedia[sender.id], err => {
            if (err) {
                return callback(err);
            }
            callback(null, asker.incomingMedia[sender.id]);
        });
    } else {
        
        myRoom.pipeline.create('WebRtcEndpoint', (err, incoming) => {
            if (err) {
                return callback(err);
            }
            
            asker.incomingMedia[sender.id] = incoming;
            
            let iceCandidateQueue = iceCandidateQueues[sender.id];
            if (iceCandidateQueue) {
                while (iceCandidateQueue.length) {
                    let ice = iceCandidateQueue.shift();
                    console.error(`user: ${sender.name} collect candidate for outgoing media`);
                    incoming.addIceCandidate(ice.candidate);
                }
            }

            incoming.on('OnIceCandidate', event => {
                let candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                socket.emit('message', {
                    event: 'candidate',
                    userid: sender.id,
                    candidate: candidate
                });
            });

            sender.outgoingMedia.connect(incoming, err => {
                if (err) {
                    return callback(err);
                }
                callback(null, incoming);
            });
        });
    }
}


// function recordVideoOf(socket, userid, roomname, sdpOffer, callback){
//     console.log("in the function");
//     var myRoom = io.sockets.adapter.rooms[roomname];
//     var asker = myRoom.participants[userid];
//     getKurentoClient((error, kurento) => {
//         kurento.create('MediaPipeline', (err, pipeline) => {
//             if (error) {
//                 return callback(err);
//             }
//             pipeline.create('WebRtcEndpoint', function(error, webRtc) {
//                 if (error) return callback(error);
//                 asker.incomingMedia[userid] = webRtc;
//                 var options = {uri : args.file_uri}
//                 pipeline.create("PlayerEndpoint", options , function(error,player){
//                     if(error) return callback(error);
//                     player.connect(webRtc, function(error){
//                         if(error) return callback(error);
//                         player.play(function(error){
//                             if(error) return callback(error) ;
//                             console.log("Playing ...");
//                         })
//                     })
//                 })
//             });
//         });
//     });

// }
function recordVideoOf(socket, userid, roomname, offer, callback){
    myRoom = io.sockets.adapter.rooms[roomname];
    myRoom.pipeline.release;
    getKurentoClient(function(error, client) {
        if (error) return onError(error);
  
        client.create('MediaPipeline', function(error, pipeline) {
          if (error) return onError(error);
  
          pipeline.create('WebRtcEndpoint', function(error, webRtc) {
            if (error) return onError(error);
  
            setIceCandidateCallbacks(socket , webRtc, onError)
  
            webRtc.processOffer(offer, function(error, sdpAnswer) {
              if (error) return onError(error);

              socket.emit('message', {
                event: 'receiveRecordAnswer',
                userid: userid,
                sdpAnswer: sdpAnswer
            });
  
              webRtc.gatherCandidates(onError);
  
              //webRtcPeer.processAnswer(answer);
            });
  
            var options = {uri : args.file_uri}
  
            pipeline.create("PlayerEndpoint", options, function(error, player) {
              if (error) return onError(error);
  
              player.on('EndOfStream', function(event){
                pipeline.release();
                videoPlayer.src = "";
  
              });
  
              player.connect(webRtc, function(error) {
                if (error) return onError(error);
  
                player.play(function(error) {
                  if (error) return onError(error);
                  console.log("Playing ...");
                  console.log(player);
                });
              });
  
            //   document.getElementById("stop").addEventListener("click",
            //   function(event){
            //     pipeline.release();
            //     webRtcPeer.dispose();
            //     videoPlayer.src="";
  
            //     hideSpinner(videoPlayer);
  
              })
            });
          });
        });
}
function setIceCandidateCallbacks(socket , webRtcEp, onerror)
{
//   webRtcPeer.on('icecandidate', function(candidate) {
//     console.log("Local candidate:",candidate);

//     candidate = kurentoClient.getComplexType('IceCandidate')(candidate);

//     webRtcEp.addIceCandidate(candidate, onerror)
    webRtcEp.on('OnIceCandidate', event => {
        let candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
        socket.emit('message', {
            event: 'recordCandidate',
            userid: socket.id,
            candidate: candidate
        });
    });

//   webRtcEp.on('OnIceCandidate', function(event) {
//     var candidate = event.candidate;

//     console.log("Remote candidate:",candidate);

//     webRtcPeer.addIceCandidate(candidate, onerror);
//   });
}
// function recordVideoOf(socket, userid, roomname, sdpOffer, callback) {
//     console.log("hooray")
//     getPlayerEndpointForUser(socket, roomname, userid, (err, endpoint) => {
//         if (err) {
//             return callback(err);
//         }

//         endpoint.processOffer(sdpOffer, (err, sdpAnswer) => {
//             if (err) {
//                 return callback(err);
//             }

//             socket.emit('message', {
//                 event: 'receiveVideoAnswer',
//                 senderid: userid,
//                 sdpAnswer: sdpAnswer
//             });

//             endpoint.gatherCandidates(err => {
//                 if (err) {
//                     return callback(err);
//                 }
//             });
//         });
//     })
// }
/////////////////
function getPlayerEndpointForUser(socket, roomname, senderid, callback) {
    console.log("hooray3")
    var myRoom = io.sockets.adapter.rooms[roomname];
    //var asker = myRoom.participants[socket.id];
    var asker = myRoom.participants[senderid];

    // if (asker.id === sender.id) {
    //     return callback(null, asker.outgoingMedia);
    // }

    // if (asker.incomingMedia[sender.id]) {
    //     sender.outgoingMedia.connect(asker.incomingMedia[sender.id], err => {
    //         if (err) {
    //             return callback(err);
    //         }
    //         callback(null, asker.incomingMedia[sender.id]);
    //     });
    // } else {
        
        myRoom.pipeline.create('WebRtcEndpoint', (err, incoming) => {
            if (err) {
                return callback(err);
            }
            
            asker.incomingMedia[asker.id] = incoming;
            
            // let iceCandidateQueue = iceCandidateQueues[sender.id];
            // if (iceCandidateQueue) {
            //     while (iceCandidateQueue.length) {
            //         let ice = iceCandidateQueue.shift();
            //         console.error(`user: ${sender.name} collect candidate for outgoing media`);
            //         incoming.addIceCandidate(ice.candidate);
            //     }
            // }

            incoming.on('OnIceCandidate', event => {
                let candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                socket.emit('message', {
                    event: 'candidate',
                    userid: sender.id,
                    candidate: candidate
                });
            });

            sender.outgoingMedia.connect(incoming, err => {
                if (err) {
                    return callback(err);
                }
                callback(null, incoming);
            });
        });
    //}
}
function getKurentoClient(callback) {
    if (kurentoClient !== null) {
        return callback(null, kurentoClient);
    }

    kurento(argv.ws_uri, function (error, _kurentoClient) {
        if (error) {
            console.log("Could not find media server at address " + argv.ws_uri);
            return callback("Could not find media server at address" + argv.ws_uri
                + ". Exiting with error " + error);
        }

        kurentoClient = _kurentoClient;
        callback(null, kurentoClient);
    });
}

function removeUser(socket)
{
    //let users=io.sockets.adapter.rooms[roomName].participants;
    io.sockets.emit('message', {    // Emit to all sockets
        event: 'userDisconnected',
        userid: socket.id
    });

}

function onError(error) {
    if(error) console.log(error);
  }

// listen
https.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});