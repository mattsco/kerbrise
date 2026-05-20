
export default function NestCamera() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: "56.25%", // ratio 16:9
        height: 0,
        overflow: "hidden",
        borderRadius: "16px",
      }}
    >
      <iframe
        src="https://video.nest.com/embedded/live/7sEyKZsVBd?autoplay=1"
        frameBorder="0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}