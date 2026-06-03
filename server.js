const express = require('express');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// Thiết lập đường dẫn cho FFmpeg (Công cụ xử lý video)
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();

// Tạo một API (Endpoint) nhận yêu cầu cắt ảnh
app.get('/api/frame', async (req, res) => {
  const videoId = req.query.videoId;
  const time = req.query.time; // Định dạng thời gian (VD: '00:15:13')

  // Kiểm tra xem có gửi đủ ID và thời gian không
  if (!videoId || !time) {
    return res.status(400).send('Thiếu videoId hoặc tham số time.');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    // 1. Lấy luồng dữ liệu (stream) video chất lượng tốt nhất từ YouTube
    const stream = ytdl(videoUrl, { quality: 'highestvideo' });

    // 2. Khai báo định dạng trả về là Hình ảnh (JPEG)
    res.setHeader('Content-Type', 'image/jpeg');

    // 3. Dùng FFmpeg để tua đến đúng giây và cắt 1 bức ảnh duy nhất
    ffmpeg(stream)
      .seekInput(time)          // Nhảy đến mốc thời gian (VD: 00:15:13)
      .frames(1)                // Chỉ cắt 1 khung hình
      .format('image2')         // Định dạng xuất ra hình ảnh
      .on('error', (err) => {
         console.error('Lỗi FFmpeg:', err);
         if (!res.headersSent) res.status(500).send('Đã xảy ra lỗi khi cắt ảnh.');
      })
      .pipe(res, { end: true }); // Trả bức ảnh trực tiếp qua đường truyền mạng về cho bạn

  } catch (error) {
    console.error('Lỗi hệ thống:', error);
    res.status(500).send(error.message);
  }
});

// Chạy server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Máy chủ cắt ảnh đang chạy ở cổng ' + listener.address().port);
});
