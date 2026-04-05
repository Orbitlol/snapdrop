import { YtdlCore, toPipeableStream } from '@ybd-project/ytdl-core/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, format } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const ytdl = new YtdlCore({});
    const info = await ytdl.getBasicInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').trim();

    if (format === 'info') {
      return res.status(200).json({
        title,
        formats: {
          video1080: `/api/download?url=${encodeURIComponent(url)}&format=video1080`,
          audio: `/api/download?url=${encodeURIComponent(url)}&format=audio`,
          video720: `/api/download?url=${encodeURIComponent(url)}&format=video720`,
        }
      });
    }

    let qualityOptions;
    let filename;
    let contentType;

    if (format === 'audio') {
      qualityOptions = { quality: 'highestaudio', filter: 'audioonly' };
      filename = `${title}.mp3`;
      contentType = 'audio/mpeg';
    } else if (format === 'video1080') {
      qualityOptions = { quality: '137', filter: 'videoandaudio' };
      filename = `${title}-1080p.mp4`;
      contentType = 'video/mp4';
    } else {
      qualityOptions = { quality: '22', filter: 'videoandaudio' };
      filename = `${title}-720p.mp4`;
      contentType = 'video/mp4';
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    const stream = await ytdl.download(url, qualityOptions);
    toPipeableStream(stream).pipe(res);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Download failed. The video may be unavailable.' });
  }
}
