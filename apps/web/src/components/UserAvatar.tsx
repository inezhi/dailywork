import type { PublicUser } from '@daily/contracts'

export function UserAvatar({ user, size = 30 }: { user: PublicUser | null; size?: number }) {
  if (!user) return null
  if (user.avatarUrl) {
    return (
      <span className="avatar avatar-image" style={{ width: size, height: size }}>
        <img src={user.avatarUrl} alt={`${user.username} 的头像`} />
      </span>
    )
  }
  const initial = Array.from(user.username.trim())[0]?.toUpperCase() ?? '?'
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      title={user.username}
      aria-label={`${user.username} 的默认头像`}
    >
      {initial}
    </span>
  )
}
