interface StaffAvatarProps {
  initials: string;
  size?: number;
  bg?: string;
  txt?: string;
}

export default function StaffAvatar({
  initials,
  size = 32,
  bg = "#E6F1FB",
  txt = "#0C447C",
}: StaffAvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: txt,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: Math.round(size * 0.4),
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
