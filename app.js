require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const routers = require('./routes');
const fs = require('fs');
const http = require('http');
const https = require('https');
const app = express();
const app_http = express();
const httpPort = 80;
const httpsPort = 443;

const path = require('path');
const { Server } = require('socket.io'); //소켓 라이브러리 불러오기
const db = require('./config');
const mysql = require('mysql');

const SocketIO = require("./socket");


app.use(cors());

const credentials = {
    key: fs.readFileSync(__dirname + '/private.key', 'utf8'),
    cert: fs.readFileSync(__dirname + '/certificate.crt', 'utf8'),
    ca: fs.readFileSync(__dirname + '/ca_bundle.crt', 'utf8'),
};

// 미들웨어 (가장 상위에 위치)
const requestMiddleware = (req, res, next) => {
    console.log(
        'ip:',
        req.ip,
        'domain:',
        req.rawHeaders[1],
        'method:',
        req.method,
        'Request URL:',
        req.originalUrl,
        '-',
        new Date(),
    );
    next();
};


app.use(helmet());
app.use(express.static('static')); 
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestMiddleware);
app.use('/', routers);

app_http.use((req, res, next) => {
    if (req.secure) {
        next();
    } else {
        const to = `https://${req.hostname}:${httpsPort}${req.url}`;
        console.log(to);
        res.redirect(to);
    }
});

app.get(
    '/.well-known/pki-validation/FEFFF8AAD41B2BDD0AC37B8AE376E000.txt',
    (req, res) => {
        res.sendFile(
            __dirname +
                '/.well-known/pki-validation/FEFFF8AAD41B2BDD0AC37B8AE376E000.txt',
        );
    },
);


http.createServer(app_http).listen(httpPort, () => {
    console.log('http서버가 켜졌어요!');
});

// server.listen(httpsPort, () => {
//     console.log('https서버가 켜졌어요!');
// });

io.on('connection', socket => {
    console.log('연결성공');

    // 채팅시작
    socket.on('startchat', param => {
        console.log('채팅시작');
        console.log(param);
        const postId = param.postid;
        const { userId, userName } = param.loggedUser;


const httpServer = http.createServer(app_http);
const httpsServer = https.createServer(credentials, app);
SocketIO(httpsServer);




        socket.to(postId).emit('connected', userName + ' 님이 입장했습니다.');
    });

    // 메세지 주고 받기
    socket.on('sendmessage', param => {
        console.log('메세지');
        console.log(param);

        const postid = param.newMessage.Post_postId;
        const postId = postid.replace('p', '');
        const userId = param.newMessage.User_userId;
        const userName = param.newMessage.User_userName;
        const userEmail = param.newMessage.User_userEmail;
        const userImage = param.newMessage.userImage;
        const chat = param.newMessage.chat;

        const sql =
            'INSERT INTO Chat (`Post_postId`, `User_userId`, `User_userName`, `User_userEmail`,`userImage`, `chat`) VALUES (?,?,?,?,?,?)';
        const data = [postId, userId, userName, userEmail, userImage, chat];

        db.query(sql, data, (err, rows) => {
            if (err) {
                console.log(err);
            } else {
                socket.to(postId).emit('receive message', param.newMessage);
            }
        });
    });

    //알림기능
    socket.on('pushalarm', param => {
        console.log(param);
        const postid = param.newMessage.Post_postId;
        const postId = postid.replace('p', '');
        const userName = param.newMessage.User_userName;

        const sql = 'SELECT title, User_userId FROM Post WHERE postId = ?;';
        const sqls = mysql.format(sql, postId);

        const sql_1 = 'SELECT User_userId FROM JoinPost WHERE Post_postId = ?;';
        const sql_1s = mysql.format(sql_1, postId);

        db.query(sqls + sql_1s, (err, rows) => {
            if (err) console.log(err);
            console.log(rows);
            const chatAdmin = rows[0].User_userId;
            const title = rows[0].title;
            const { users } = rows[1];
            // console.log(chatAdmin, users);
            // socket.join(postid);
            socket
                .to(chatAdmin)
                .emit(
                    'pushalarm',
                    title +
                        '게시글 채팅방에서' +
                        userName +
                        ' 님께서 새로운 채팅을 남겼습니다.',
                );
            socket
                .to({ users })
                .emit(
                    'pushalarm',
                    title +
                        '게시글 채팅방에서' +
                        userName +
                        ' 님께서 새로운 채팅을 남겼습니다.',
                );
        });
    });

    //찐참여자 선택
    socket.on('add_new_participant', param => {
        console.log(param);
        const postid = param.postid;
        const postId = postid.replace('p', '');
        const userId = param.selectedUser.User_userId;

        const sql =
            'UPDATE JoinPost SET isPick = 1 WHERE Post_postId=? and User_userId=?;';
        const data = [postId, userId];
        const sqls = mysql.format(sql, data);

        const sql_1 =
            'SELECT * FROM JoinPost WHERE isPick = 1 and Post_postId = ?;';
        const sql_1s = mysql.format(sql_1, postId);

        const sql_2 =
            'SELECT * FROM JoinPost WHERE isPick = 0 and Post_postId = ?;';
        const sql_2s = mysql.format(sql_2, postId);

        db.query(sqls + sql_1s + sql_2s, (err, rows) => {
            if (err) {
                console.log(err);
            } else {
                const headList = rows[1];
                const waitList = rows[2];
                console.log(headList);
                socket
                    .to(postid)
                    .emit(
                        'receive_participant_list_after_added',
                        headList,
                        waitList,
                    );
            }
        });
    });

    //찐참여자 선택 취소
    socket.on('cancel_new_participant', param => {
        const postid = param.postid;
        const postId = postid.replace('p', '');
        const userId = param.selectedUser.User_userId;

        const sql =
            'UPDATE JoinPost SET isPick = 0 WHERE Post_postId=? and User_userId=?;';
        const data = [postId, userId];
        const sqls = mysql.format(sql, data);

        const sql_1 =
            'SELECT * FROM JoinPost WHERE isPick = 1 and Post_postId = ?;';
        const sql_1s = mysql.format(sql_1, postId);

        const sql_2 =
            'SELECT * FROM JoinPost WHERE isPick = 0 and Post_postId = ?;';
        const sql_2s = mysql.format(sql_2, postId);

        db.query(sqls + sql_1s + sql_2s, (err, rows) => {
            if (err) {
                console.log(err);
            } else {
                const headList = rows[1];
                const waitList = rows[2];
                console.log(headList);
                socket
                    .to(postid)
                    .emit(
                        'receive_participant_list_after_canceled',
                        headList,
                        waitList,
                    );
            }
        });
    });

    //채팅방 나가기
    // socket.on('disconnect', param => {
    //     const postId = param.postid;
    //     const { userId, userName } = param.loggedUser;

    //     const sql = 'DELETE FROM JoinPost WHERE Post_postId=? and User_userId=?';
    //     const params = [postId, userId];

    //     db.query(sql, params, (err, data) => {
    //         if (err) console.log(err);
    //         res.status(201).send({ msg: 'success', data });
    //     });

    //     socket.leave(postId);
    //     io.to(postId).emit('onDisconnect', userName + ' 님이 퇴장했습니다.');
    // })
});

//도메인
app.listen(port, () => {
    console.log(port, '포트로 서버가 켜졌어요!');
});

httpServer.listen(httpPort, () => {
    console.log('http서버가 켜졌어요!');
});

httpsServer.listen(httpsPort, () => {
    console.log('https서버가 켜졌어요!');
});
