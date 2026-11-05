require "test_helper"

class SessionsControllerTest < ActionDispatch::IntegrationTest
  setup { @user = User.take }

  test "new" do
    get new_session_path
    assert_response :success
  end

  test "create with valid credentials" do
    post session_path, params: { email_address: @user.email_address, password: "password" }

    assert_redirected_to root_path
    assert cookies[:session_id]
  end

  test "create with invalid credentials" do
    post session_path, params: { email_address: @user.email_address, password: "wrong" }

    assert_redirected_to new_session_path
    assert_nil cookies[:session_id]
  end

  test "create with a username, ignoring case" do
    @user.update!(username: "Neo")
    post session_path, params: { username: " neo ", password: "password" }

    assert_redirected_to root_path
    assert cookies[:session_id]
  end

  test "create with a username and the wrong password" do
    @user.update!(username: "Neo")
    post session_path, params: { username: "Neo", password: "wrong" }

    assert_redirected_to new_session_path
    assert_nil cookies[:session_id]
  end

  test "create with an unknown username" do
    post session_path, params: { username: "nobody", password: "password" }

    assert_redirected_to new_session_path
    assert_nil cookies[:session_id]
  end

  test "create with both email and username of the same user" do
    @user.update!(username: "Neo")
    post session_path, params: { email_address: @user.email_address, username: "Neo", password: "password" }

    assert_redirected_to root_path
  end

  test "create rejects an email and username of different users" do
    users(:two).update!(username: "Trinity")
    post session_path, params: { email_address: users(:one).email_address, username: "Trinity", password: "password" }

    assert_redirected_to new_session_path
    assert_nil cookies[:session_id]
  end

  test "create with neither email nor username" do
    post session_path, params: { password: "password" }

    assert_redirected_to new_session_path
  end

  test "destroy" do
    sign_in_as(User.take)

    delete session_path

    assert_redirected_to new_session_path
    assert_empty cookies[:session_id]
  end
end
