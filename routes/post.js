const express = require('express');
const router = express.Router();
const db = require('../config');
const moment = require('moment');
require('moment-timezone');
moment.tz.setDefault('Asia/seoul');

const authMiddleware = require('../middlewares/auth');
const upload = require('../S3/s3');


// 게시글 조회
router.get('/:postId', (req, res) => {
    const postId = req.params.postId;
    

    const sql =
        "SELECT P.postId, P.User_userId, P.title, P.content, P.writer, P.price, P.headCount, P.category, P.isDone, P.image, P.lat, P.lng, P.address, P.createdAt, P.endTime, GROUP_CONCAT( DISTINCT U1.userId SEPARATOR ',') headList, U.userName, U.userImage FROM `Post` P  JOIN `User` U ON P.User_userId = U.userId LEFT OUTER JOIN `JoinPost` JP ON P.postId = JP.Post_postId and JP.isPick = 1 LEFT OUTER JOIN `User` U1 ON JP.User_userId = U1.userId LEFT OUTER JOIN `User` U2 ON P.User_userId = U2.userId WHERE `postId`= ? GROUP BY P.postId, P.User_userId, P.title, P.content, P.writer, P.price, P.headCount, P.category, P.isDone, P.image, P.lat, P.lng, P.address, P.createdAt, P.endTime, U.userName, U.userImage";

    db.query(sql, postId, (err, data) => {
        if (err) console.log(err);
        let head = data[0].headList;
        const bossId = data[0].User_userId
        let newList =[];
        console.log(head)
        
        if (isNaN(Number(head))) {
            console.log(1)
            data[0].headList = head.split(',').map(Number).filter (id => id !== bossId);
        } else {
            if (Number(head) === bossId) {
                console.log(2)
                data[0].headList = newList;
            } else if (head === null){
                console.log(3)
                data[0].headList = newList;
            }      
        } 
        console.log(data)
        res.send({ msg: 'success', data });
    });
});

// 게시글 작성
router.post(
    '/postadd',
    authMiddleware,
    upload.single('image'),
    (req, res, next) => {
        
        const {
            title,
            content,
            price,
            headCount,
            category,
            endTime,
            address,
            lat,
            lng,
        } = req.body;
        console.log(endTime, 'endTime')

        const writer = res.locals.user.userName;
        const User_userId = res.locals.user.userId;

        const image = req.file?.location;
        const endTimeAdd = moment(endTime).add("1439","m").format("YYYY-MM-DD HH:mm:ss")

        const datas = [
            title,
            content,
            price,
            headCount,
            category,
            endTimeAdd,
            address,
            lat,
            lng,
            writer,
            User_userId,
            image,
        ];

        const sql =
            'INSERT INTO Post (`title`, `content`, `price`, `headCount`, `category`, `endTime`, `address`, `lat`, `lng`, `writer`, `User_userId`, `image`, `isDone`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,false)';

        db.query(sql, datas, (err, rows) => {
            if (err) {
                console.log(err);
                res.status(201).send({ msg: 'fail' });
            } else {
                const postId = rows.insertId;
                
                db.query(
                    'SELECT P.postId, P.User_userId, P.title, P.content, P.writer, P.price, P.headCount, P.category, P.isDone, P.image, P.lat, P.lng, P.address, P.createdAt, P.endTime, CASE WHEN GROUP_CONCAT(L.User_userId) is null THEN false ELSE true END isLike FROM `Post` P LEFT OUTER JOIN `User` U ON P.User_userId = U.userId LEFT OUTER JOIN `Like` L ON L.Post_postId = P.postId and L.User_userId = ? WHERE `postId`= ? GROUP BY P.postId, P.User_userId, P.title, P.content, P.writer, P.price, P.headCount, P.category, P.isDone, P.image, P.lat, P.lng, P.address, P.createdAt, P.endTime', [User_userId, postId],
                    (err, row) => {
                        if(err) console.log(err)

                        db.query('SELECT userEmail, userImage FROM User WHERE userId = ?', User_userId, (err, writerInfo) => { 
                            if(err) console.log(err)   

                            const userEmail = writerInfo[0].userEmail
                            const userImage = writerInfo[0].userImage   
                            
                            const insertParam = [User_userId, postId, userEmail, writer, userImage,1]
                            db.query('INSERT INTO `JoinPost` (`User_userId`, `Post_postId`,User_userEmail, User_userName, userImage, `isPick`) VALUES (?,?,?,?,?,?)', insertParam, (err, rows) => { 
                                if(err) console.log(err)             
                            }) 

                        })

                        res.status(201).send({ msg: 'success', row });
                    },
                );
            }
        });
    },
);

// 게시글 삭제
router.delete('/:postId', authMiddleware, (req, res, next) => {
    const postId = req.params.postId;
    const userId = res.locals.user.userId;
    const sql = 'DELETE FROM Post WHERE postId=?';

    db.query(sql, postId, function (err, result) {
        if (err) {
            console.log(err);
            res.status(201).send({ msg: 'fail' });
        } else {
            const sql = 'UPDATE User SET point = point-3 WHERE userId=?';
            db.query(sql, userId, function (err, result) {
                res.status(201).send({ msg: 'success' });
            });
        }
    });
});

// 게시글 거래완료
router.put('/:postId', authMiddleware, (req, res) => {
    const postId = req.params.postId;
    const userId = res.locals.user.userId;

    const sql =
        'UPDATE `Post` SET `isDone`= 1 WHERE `postId`=? AND `User_userId`=?';
    const param = [postId, userId];

    db.query(sql, param, function (err, result) {
        if (err) console.log(err);
        else {
            const sql = 'UPDATE User SET point = point+3 WHERE userId=?';
            db.query(sql, userId, function (err, result) {
                res.send({ msg: 'success' });
            });
        }

    });
});



module.exports = router;