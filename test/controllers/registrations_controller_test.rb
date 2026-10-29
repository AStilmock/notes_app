require "test_helper"

class RegistrationsControllerTest < ActionDispatch::IntegrationTest
  test "new" do
    get new_registration_url
    assert_response :success
  end

  test "create signs the new user in" do
    assert_difference("User.count") do
      post registration_url, params: { user: { email_address: "New@Example.com ", password: "longenough", password_confirmation: "longenough" } }
    end
    assert_redirected_to root_url
    assert cookies[:session_id]
    assert User.exists?(email_address: "new@example.com")
  end

  test "create rejects short passwords and duplicate emails" do
    assert_no_difference("User.count") do
      post registration_url, params: { user: { email_address: users(:one).email_address, password: "short", password_confirmation: "short" } }
    end
    assert_response :unprocessable_entity
    assert_select "#errors li", 2
  end
end
