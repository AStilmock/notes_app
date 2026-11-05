class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :note_pads, dependent: :destroy
  has_many :spread_sheets, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }
  # Optional: a blank username is stored as nil, so the email shows instead.
  normalizes :username, with: ->(u) { u.strip.presence }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, length: { minimum: 8 }, allow_nil: true
  validates :username, length: { in: 3..30 }, uniqueness: { case_sensitive: false },
            format: { with: /\A[a-zA-Z0-9_.-]+\z/, message: "can only use letters, numbers, _ . and -" },
            allow_nil: true

  # Log in with an email or a username (either one). When both are given they must belong to the same user.
  def self.authenticate_by_login(email_address:, username:, password:)
    email_address = email_address.to_s.strip
    username = username.to_s.strip

    if email_address.present?
      user = authenticate_by(email_address: email_address, password: password)
      user if user && (username.blank? || user.username&.casecmp?(username))
    elsif username.present?
      user = where("lower(username) = ?", username.downcase).first
      if user
        user if user.authenticate(password)
      else
        # Hash the password anyway so a missing username takes as long as a wrong password (like authenticate_by).
        new(password: password)
        nil
      end
    end
  end

  # What the menu bar shows for this user.
  def display_name
    username || email_address
  end
end
