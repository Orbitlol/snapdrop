import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  // Allow your frontend to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, format } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    if (format === 'info') {
      // Return video info + available formats
      const info = await ytdl.getInfo(url);
      const title = info.videoDetails.title;

      // Find best video+audio formats
      const formats = info.formats;

      const video1080 = formats.find(f =>
        f.qualityLabel === '1080p' && f.hasAudio && f.hasVideo
      ) || formats.find(f =>
        f.qualityLabel === '1080p' && f.hasVideo
      ) || formats.find(f => f.qualityLabel === '720p' && f.hasAudio && f.hasVideo);

      const audio = formats
        .filter(f => f.hasAudio && !f.hasVideo)
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

      return res.status(200).json({
        title,
        formats: {
          video1080: video1080 ? `/api/download?url=${encodeURIComponent(url)}&format=video1080` : null,
          audio: audio ? `/api/download?url=${encodeURIComponent(url)}&format=audio` : null,
          video720: `/api/download?url=${encodeURIComponent(url)}&format=video720`,
        }
      });
    }

    // Stream the actual file
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').trim();

    let chosenFormat;
    let filename;
    let contentType;

    if (format === 'audio') {
      chosenFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
      filename = `${title}.mp3`;
      contentType = 'audio/mpeg';
    } else if (format === 'video1080') {
      // Try to get 1080p with audio, fall back to best available
      chosenFormat = info.formats.find(f => f.qualityLabel === '1080p' && f.hasAudio && f.hasVideo)
        || ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'videoandaudio' });
      filename = `${title}-1080p.mp4`;
      contentType = 'video/mp4';
    } else {
      // video720 or fallback
      chosenFormat = info.formats.find(f => f.qualityLabel === '720p' && f.hasAudio && f.hasVideo)
        || ytdl.chooseFormat(info.formats, { quality: '137', filter: 'videoandaudio' })
        || ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'videoandaudio' });
      filename = `${title}-720p.mp4`;
      contentType = 'video/mp4';
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    ytdl(url, { format: chosenFormat }).pipe(res);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Download failed. The video may be unavailable or age-restricted.' });
  }
        }
