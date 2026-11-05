require "test_helper"

class AccountsControllerTest < ActionDispatch::IntegrationTest
  setup { sign_in_as(users(:one)) }

  test "menu shows the email until a username is set" do
    get root_url
    assert_select "nav a", text: "USER: one@example.com"

    patch account_url, params: { user: { username: "Neo" } }
    assert_redirected_to edit_account_url

    get root_url
    assert_select "nav a", text: "USER: Neo"
  end

  test "clearing the username shows the email again" do
    users(:one).update!(username: "Neo")
    patch account_url, params: { user: { username: "" } }
    assert_nil users(:one).reload.username
  end

  test "rejects a taken username" do
    users(:two).update!(username: "neo")
    patch account_url, params: { user: { username: "NEO" } }
    assert_response :unprocessable_entity
    assert_select "#errors li", 1
  end

  test "requires login" do
    sign_out
    get edit_account_url
    assert_redirected_to new_session_url
  end
end
