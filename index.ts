/** Initializing Imports */
var send: boolean = false;
import Express = require("express");
var app = Express();
import http = require("https");
var sgMail = require("@sendgrid/mail");
import bodyParser = require('body-parser');
import fs = require("fs");
import multer = require("multer");

/** Initializing multer to accept attachments */
var file_name = "";
const storage = multer.diskStorage({
   destination: function (req: any, file: any, cb: any) {
      file_name = file.originalname;
      cb(null, './');
   },
   filename: function (req: any, file: any, cb: any) {
      file_name = file.originalname;
      cb(null, file.originalname);
   }
});
const upload = multer({ storage: storage });

/** Add more configs */
sgMail.setApiKey(process.env.API_KEY);
sgMail.setSubstitutionWrappers('{{', '}}');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

/** Simplest Route for testing */
app.get('/', function (req, res) {
   res.send("Hello world!");
});

/** POST Route for sending e-mail(s) */
/**
 * @params
 * start_time : Start time of request
 * end_time : End time of request, used to find failed messages in a given time interval
 * ll : no of customizations aka no of toS
 * cc : cc of email body
 * bcc : bcc of email body
 * personalizations_block : Individual unit of userData
 * set : stores all emails sent and prevents duplicate email sent if an email already exist
 * fs
 * unit : single customization block passed to SendGrid
 * sgMail : SendGrid module to send emails easlily via SendGrid
 */
app.post('/test', upload.single('binaryFile'), function (req, res) {
   /** Initializing vars */
   var start_time = Math.floor(new Date().getTime() / 1000);
   start_time -= 60;

   var user = req.body.userData;
   
   var ll = Object.keys(user).length;
   var to = []
   var cc = [];
   var bcc = [];
   var sub = {}
   var personalizations_block: any = [];

   var set = new Set();

   for (let index = 0; index < ll; index++) {
      if (!set.has(user[index].email)) {
         set.add(user[index].email);
         to = [];
         cc = [];
         bcc = [];
         var details = {
            email: user[index].email
         }
         to.push(details);// add 'to'

         /** Add cc */
         if (user[index].cc != null) {
            console.log("There is at least 1 cc");
            if (!Array.isArray(user[index].cc)) {
               console.log("Lenght is 1");
               cc.push({ "email": user[index].cc });
               set.add(user[index].cc);
            } else {
               console.log("Lenght is > 1");
               for (var i = 0; i < Object.keys(user[index].cc).length; i++) {
                  cc.push({ "email": user[index].cc[i] });
                  set.add(user[index].cc[i]);
               }
            }
         }

         /** Add bcc */
         if (user[index].bcc != null) {
            console.log("There is at least 1 bcc");
            if (!Array.isArray(user[index].bcc)) {
               console.log("Lenght is 1");
               bcc.push({ "email": user[index].bcc });
               set.add(user[index].bcc);
            } else {
               console.log("Lenght is > 1");
               for (var i = 0; i < Object.keys(user[index].bcc).length; i++) {
                  bcc.push({ "email": user[index].bcc[i] });
                  set.add(user[index].bcc[i]);
               }
            }
         }

         /** Combine all data to send to SendGrid */
         var unit = {
            'to': to,
            'cc': cc,
            'bcc': bcc,
            "substitutions": {
               "name": user[index].name,
               "status": user[index].status
            }
         };
         personalizations_block.push(unit);
      }
   }

   fs.readFile((file_name), (err: any, data: any) => {// read file
      /** If there is no PDF attached execute this block */
      if (err) {
         console.log('PDF NOT FOUND');
         var msg = {
            from: 'shivamrocksdeoghar@gmail.com',
            personalizations: personalizations_block,
            subject: "Marks Announced",
            html: req.body.emailMessage,
         };
         console.log(msg.personalizations[0]);
         if (send) {
            sgMail//send mail
               .send(msg)
               .then(function () {
                  console.log('Email sent');
               })["catch"](function (error) {
                  console.log("THERE IS An ERROR sending Email");
                  console.error(error);
                  res.status(403).send('Email could not be send! Check your input format');
               });
         }
      }
      /** If there is a PDF attached execute this block */
      if (data) {
         console.log('PDF FOUND');
         var msg1 = {
            from: 'shivamrocksdeoghar@gmail.com',
            personalizations: personalizations_block,
            subject: "Marks Announced",
            html: '<html><head><title></title></head><body>Hello {{name}} ,<br /><br/>Results are out  Thanks for your Time<br /><br/><br /><br/>You are designated as {{status}} :)<br /><br/></body></html>',
            attachments: [
               {
                  content: data.toString('base64'),
                  filename: file_name,
                  type: 'application/pdf',
                  disposition: 'attachment',
                  contentId: 'mytext',
               },
            ]
         };
         console.log(msg1.personalizations);
         if (send) {
            sgMail
               .send(msg1)//send mail
               .then(result => {
                  console.log("Sent email");
               }, err => {
                  console.log("There is an error");
                  console.error(err);
               });
         }
      }
   });

   /** Delete Attachment after sending mail */
   /**
   *try {
   *   fs.unlinkSync(path)
   *   console.log("FILE DELETE SUCCESSFUL")
   *   //file removed
   *} catch (err) {
   *   console.error(err);
   *   console.log("FILE COULD NOT BE DELETED");
   *}
   */


/** Call SendGrid to check for failed mails in a given time interval */
   var end_time = Math.floor(new Date().getTime() / 1000);
   var options = {
      "method": "GET",
      "hostname": "api.sendgrid.com",
      "port": null,
      "path": "/v3/suppression/bounces?end_time=" + end_time + "&start_time=" + start_time,
      "headers": {
         "authorization": "Bearer "+process.env.API_KEY,
         "accept": "application/json"
      }
   };
   var failure_body: any = [];
   var failure_req = http.request(options, function (failure_res) {
      var chunks: any = [];

      failure_res.on("data", function (chunk) {
         chunks.push(chunk);
      });

      failure_res.on("end", function () {
         var body = Buffer.concat(chunks);
         failure_body = body;
         //   console.log(body.toString());
      });
   });

   failure_req.write("{}");
   failure_req.end();

   /** Return Success */
   res.json({ 'status': 200, 'message': 'Successfully added mails to queue', 'data': { 'success': Array.from(set), 'failure': failure_body, 'note': 'Check your Dashboard or set up a Webhook to get live values of failures. Emails are put in queue, they may take sometime to arrive or decide to fail' } });
});

app.listen(3000);

