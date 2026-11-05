require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "downcases and strips email_address" do
    user = User.new(email_address: " DOWNCASED@EXAMPLE.COM ")
    assert_equal("downcased@example.com", user.email_address)
  end

  test "username is optional and blank becomes nil" do
    user = users(:one)
    user.username = "  "
    assert user.valid?
    assert_nil user.username
  end

  test "display_name falls back to the email" do
    user = users(:one)
    assert_equal "one@example.com", user.display_name
    user.username = "Neo"
    assert_equal "Neo", user.display_name
  end

  test "username must be unique ignoring case and use allowed characters" do
    users(:one).update!(username: "Neo")
    user = users(:two)
    user.username = "neo"
    assert_not user.valid?
    user.username = "has space"
    assert_not user.valid?
    user.username = "ab"
    assert_not user.valid?
    user.username = "trinity_99"
    assert user.valid?
  end
end
