class AddUserToNotePads < ActiveRecord::Migration[8.1]
  def up
    add_reference :note_pads, :user, foreign_key: true, index: false
    add_index :note_pads, %i[user_id position]

    # pads written before logins existed go to the first user (created here if there is none)
    if select_value("SELECT COUNT(*) FROM note_pads").to_i.positive?
      owner_id = select_value("SELECT id FROM users ORDER BY id LIMIT 1") || create_owner
      execute "UPDATE note_pads SET user_id = #{Integer(owner_id)} WHERE user_id IS NULL"
    end

    change_column_null :note_pads, :user_id, false
  end

  def down
    remove_reference :note_pads, :user, foreign_key: true, index: false
  end

  private

  def create_owner
    email = ENV.fetch("OWNER_EMAIL", "owner@notes.local")
    password = ENV.fetch("OWNER_PASSWORD") { SecureRandom.base58(16) }
    digest = BCrypt::Password.create(password)

    id = select_value(<<~SQL)
      INSERT INTO users (email_address, password_digest, created_at, updated_at)
      VALUES (#{quote(email)}, #{quote(digest)}, NOW(), NOW()) RETURNING id
    SQL

    say "Existing note pads now belong to #{email} / password: #{password}"
    say "Sign in with that, then change the password (or set OWNER_EMAIL / OWNER_PASSWORD before migrating)."
    id
  end
end
