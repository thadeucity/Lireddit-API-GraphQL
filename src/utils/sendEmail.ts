'use strict';
// user: 'ufjjd375fjxqv7td@ethereal.email',
// pass: 'Y32wwPfD1jpn6jJAse',

import nodemailer from 'nodemailer';

async function sendEmail(to: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'ufjjd375fjxqv7td@ethereal.email',
      pass: 'Y32wwPfD1jpn6jJAse',
    },
  });

  const info = await transporter.sendMail({
    from: '"Fred Foo 👻" <foo@example.com>',
    to,
    subject: 'Change password',
    html,
  });

  console.log('Message sent: %s', info.messageId);

  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
}

export default sendEmail;
