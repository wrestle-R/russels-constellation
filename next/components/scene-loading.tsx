export default function SceneLoading() {
  return (
    <div className="scene-loading" role="status" aria-live="polite">
      <svg
        className="loading-constellation"
        viewBox="0 0 180 140"
        aria-hidden="true"
      >
        <g className="loading-threads">
          <path d="M28 87 53 37 94 23 139 51 154 99 109 118 68 99 53 37M28 87 68 99 94 23 109 118 139 51 53 37" />
        </g>
        {[
          [28, 87],
          [53, 37],
          [94, 23],
          [139, 51],
          [154, 99],
          [109, 118],
          [68, 99],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={i === 2 ? 3 : 2}
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </svg>
      <span>
        Gathering your stars<span className="loading-ellipsis">…</span>
      </span>
    </div>
  );
}
