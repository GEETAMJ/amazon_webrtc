// getting dom elements
var divRoomSelection = document.getElementById('roomSelection');
var divMeetingRoom = document.getElementById('meetingRoom');
var inputRoom = document.getElementById('room');
var inputName = document.getElementById('name');
var btnRegister = document.getElementById('register');

// variables
var roomName;
var userName;
var participants = {};
var ws = new WebSocket('wss://' + location.host + '/one2one');
var rtcPeerForRecord=null;

// Let's do this
var socket = io();

btnRegister.onclick = function () {
    roomName = inputRoom.value;
    userName = inputName.value;

    if (roomName === '' || userName === '') {
        alert('Room and Name are required!');
    } else {
        var message = {
            event: 'joinRoom',
            userName: userName,
            roomName: roomName
        }
        sendMessage(message);
        divRoomSelection.style = "display: none";
        divMeetingRoom.style = "display: block";
    }
}

// messages handlers
socket.on('message', message => {
    console.log('Message received: ' + message.event);

    switch (message.event) {
        case 'newParticipantArrived':
            receiveVideo(message.userid, message.username);
            break;
        case 'existingParticipants':
            onExistingParticipants(message.userid, message.existingUsers);
            break;
        case 'receiveVideoAnswer':
            onReceiveVideoAnswer(message.senderid, message.sdpAnswer);
            break;
        case 'candidate':
            addIceCandidate(message.userid, message.candidate);
            break;
        case 'recordCandidate':
            addIceCandidateForRecording(message.candidate);
            break;
        case 'receiveRecordAnswer':
            onReceiveRecordAnswer(message.sdpAnswer);
            break;
    }
});

// handlers functions
function receiveVideo(userid, username) {
    var video = document.createElement('video');
    var div = document.createElement('div');
    div.className = "videoContainer";
    var name = document.createElement('div');
    video.id = userid;
    video.autoplay = true;
    name.appendChild(document.createTextNode(username));
    div.appendChild(video);
    div.appendChild(name);
    
    divMeetingRoom.appendChild(div);

    var user = {
        id: userid,
        username: username,
        video: video,
        rtcPeer: null
    }

    participants[user.id] = user;

    var options = {
        remoteVideo: video,
        onicecandidate: onIceCandidate
    }

    user.rtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
        function (err) {
            if (err) {
                return console.error(err);
            }
            this.generateOffer(onOffer);
        }
    );

    var onOffer = function (err, offer, wp) {
        console.log('sending offer');
        var message = {
            event: 'receiveVideoFrom',
            userid: user.id,
            roomName: roomName,
            sdpOffer: offer
        }
        sendMessage(message);
    }

    function onIceCandidate(candidate, wp) {
        console.log('sending ice candidates');
        var message = {
            event: 'candidate',
            userid: user.id,
            roomName: roomName,
            candidate: candidate
        }
        sendMessage(message);
    }
}

function onExistingParticipants(userid, existingUsers) {
    var video = document.createElement('video');
    var div = document.createElement('div');
    div.className = "videoContainer";
    var name = document.createElement('div');
    video.id = userid;
    video.autoplay = true;
    name.appendChild(document.createTextNode(userName));
    div.appendChild(video);
    div.appendChild(name);
    divMeetingRoom.appendChild(div);
    var btn1 = document.createElement("BUTTON");
    btn1.innerHTML = "Record";
    btn1.id = "record";
    div.appendChild(btn1);
    document.getElementById('record').addEventListener('click', function() {
		record(userid);
	});
    var btn2 = document.createElement("BUTTON");
    btn2.innerHTML = "Stop";
    btn1.id = "stop";
    div.appendChild(btn2);
    // var video1 = document.createElement('video');
    // video1.id = "player";
    // div.appendChild(video1);
    var user = {
        id: userid,
        username: userName,
        video: video,
        rtcPeer: null
    }

    participants[user.id] = user;

    var constraints = {
        audio: true,
        video : {
			mandatory : {
				maxWidth : 320,
				maxFrameRate : 15,
				minFrameRate : 15
			}
		}
    };

    var options = {
        localVideo: video,
        mediaConstraints: constraints,
        onicecandidate: onIceCandidate
    }

    user.rtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options,
        function (err) {
            if (err) {
                return console.error(err);
            }
            this.generateOffer(onOffer)
        }
    );

    existingUsers.forEach(function (element) {
        receiveVideo(element.id, element.name);
    });

    var onOffer = function (err, offer, wp) {
        console.log('sending offer');
        var message = {
            event: 'receiveVideoFrom',
            userid: user.id,
            roomName: roomName,
            sdpOffer: offer
        }
        sendMessage(message);
    }

    function onIceCandidate(candidate, wp) {
        console.log('sending ice candidates');
        var message = {
            event: 'candidate',
            userid: user.id,
            roomName: roomName,
            candidate: candidate
        }
        sendMessage(message);
    }
}

function onReceiveVideoAnswer(senderid, sdpAnswer) {
    participants[senderid].rtcPeer.processAnswer(sdpAnswer);
}

function addIceCandidate(userid, candidate) {
    participants[userid].rtcPeer.addIceCandidate(candidate);
}
function addIceCandidateForRecording(candidate)
{
    rtcPeerForRecord.addIceCandidate(candidate);
}
function onReceiveRecordAnswer(sdpAnswer) {
    rtcPeerForRecord.processAnswer(sdpAnswer);
}
////////////
function record(userid) {

    // var message = {
    //     event: 'record',
    // }
    // sendMessage(message);
	// setRegisterState(REGISTERING);

	// var message = {
	// 	id : 'record',
	// 	name : 
	// };
	// sendMessage(message);
    // document.getElementById('peer').focus();
    var video = document.createElement('video');
    var div = document.createElement('div');
    div.className = "videoContainer";
    var name = document.createElement('div');
    name.appendChild(document.createTextNode(userName+" - Replay"));
    video.id = "recordWindow";
    //video.autoplay = true;
    div.appendChild(video);
    div.appendChild(name);
    
    divMeetingRoom.appendChild(div);

    // var user = {
    //     id: userid,
    //     video: video,
    //     rtcPeer: null
    // }
    var user = participants[userid];
    //participants[user.id] = user;

    var options = {
        remoteVideo: document.getElementById(userid),
        //onicecandidate: onIceCandidate
    }

    rtcPeerForRecord = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
        function (err) {
            if (err) {
                return console.error(err);
            }
            //rtcPeerForRecord=user.rtcPeer;
            this.generateOffer(function (error,offerSdp){
                onOfferPlay(error,offerSdp,userid);
            });
        }
    );
    function onIceCandidate(candidate, wp) {
        console.log('sending ice candidates');
        var message = {
            event: 'candidate',
            userid: user.id,
            roomName: roomName,
            candidate: candidate
        }
        sendMessage(message);
    }
}
function onOfferPlay(error, sdpOffer, userid) {
	console.log('Invoking SDP offer callback function');
	var message = {
        event : 'record',
        userid : userid,
        user : "geetam",
        roomName : roomName,
		sdpOffer : sdpOffer
	};
	sendMessage(message);
}
// utilities
function sendMessage(message) {
    console.log('sending ' + message.event + ' message to server');
    socket.emit('message', message);
}
