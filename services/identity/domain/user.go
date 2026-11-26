// 用户聚合：邮箱与手机号二选一
package domain

import (
	"errors"
	"regexp"
	"time"
)

var (
	// 邮箱格式不对
	ErrEmailInvalid = errors.New("domain: invalid email")
	// 手机号格式不对
	ErrPhoneInvalid = errors.New("domain: invalid phone")
	// 邮箱与手机号都没传
	ErrIdentifierMissing = errors.New("domain: email or phone is required")
	// 邮箱与手机号同时传了
	ErrIdentifierBoth = errors.New("domain: only one of email or phone is allowed")
	// 密码哈希为空
	ErrPasswordHashEmpty = errors.New("domain: password hash is required")
)

// 邮箱格式：有且只有一个 @，两边非空
var emailPattern = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// 中国大陆手机号：1 开头，第二位 3-9，共 11 位
var phonePattern = regexp.MustCompile(`^1[3-9][0-9]{9}$`)

// Email 是邮箱值对象，构造出来就是合法的
type Email string

// 校验格式并构造邮箱
func NewEmail(value string) (Email, error) {
	if !emailPattern.MatchString(value) {
		return "", ErrEmailInvalid
	}
	return Email(value), nil
}

// 返回原始字符串
func (e Email) String() string {
	return string(e)
}

// Phone 是手机号值对象，构造出来就是合法的
type Phone string

// 校验格式并构造手机号
func NewPhone(value string) (Phone, error) {
	if !phonePattern.MatchString(value) {
		return "", ErrPhoneInvalid
	}
	return Phone(value), nil
}

// 返回原始字符串
func (p Phone) String() string {
	return string(p)
}

// User 是用户聚合，字段不导出，只能通过工厂方法创建
type User struct {
	id              string
	email           *Email
	phone           *Phone
	passwordHash    string
	avatarURL       string
	membershipLevel int
	createdAt       time.Time
	updatedAt       time.Time
}

// 创建用户需要的字段
type NewUserParams struct {
	ID           string
	Email        *Email
	Phone        *Phone
	PasswordHash string
	Now          time.Time
}

// 校验不变量并创建用户
func NewUser(p NewUserParams) (*User, error) {
	if p.Email == nil && p.Phone == nil {
		return nil, ErrIdentifierMissing
	}
	if p.Email != nil && p.Phone != nil {
		return nil, ErrIdentifierBoth
	}
	if p.PasswordHash == "" {
		return nil, ErrPasswordHashEmpty
	}

	return &User{
		id:              p.ID,
		email:           p.Email,
		phone:           p.Phone,
		passwordHash:    p.PasswordHash,
		membershipLevel: 0,
		createdAt:       p.Now,
		updatedAt:       p.Now,
	}, nil
}

// 从数据库还原用户，不重放校验
func Reconstitute(
	id string,
	email *Email,
	phone *Phone,
	passwordHash string,
	avatarURL string,
	membershipLevel int,
	createdAt time.Time,
	updatedAt time.Time,
) *User {
	return &User{
		id:              id,
		email:           email,
		phone:           phone,
		passwordHash:    passwordHash,
		avatarURL:       avatarURL,
		membershipLevel: membershipLevel,
		createdAt:       createdAt,
		updatedAt:       updatedAt,
	}
}

// 返回用户 id
func (u *User) ID() string { return u.id }

// 返回邮箱
func (u *User) Email() *Email { return u.email }

// 返回手机号
func (u *User) Phone() *Phone { return u.phone }

// 返回密码哈希
func (u *User) PasswordHash() string { return u.passwordHash }

// 返回头像地址
func (u *User) AvatarURL() string { return u.avatarURL }

// 返回会员等级
func (u *User) MembershipLevel() int { return u.membershipLevel }

// 返回创建时间
func (u *User) CreatedAt() time.Time { return u.createdAt }

// 返回更新时间
func (u *User) UpdatedAt() time.Time { return u.updatedAt }
