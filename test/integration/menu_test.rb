require "test_helper"

class MenuTest < ActionDispatch::IntegrationTest
  setup { sign_in_as users(:one) }

  test "every page has the menu bar with shortcuts" do
    get note_pads_url
    assert_select "nav[data-controller=menu]" do
      assert_select "a[data-menu-key=F1][data-menu-alt=n][href=?]", note_pads_path
      assert_select "a[data-menu-key=F2][data-menu-alt=s][href=?]", spread_sheets_path
    end
  end

  test "the current section is marked active" do
    get note_pad_url(note_pads(:one))
    assert_select "nav a[aria-current=page][href=?]", note_pads_path

    get spread_sheet_url(spread_sheets(:one))
    assert_select "nav a[aria-current=page][href=?]", spread_sheets_path
  end

  test "shows the user and a logout button" do
    get note_pads_url
    assert_select "nav", text: /one@example.com/
    assert_select "nav form[action=?] button", session_path, text: "LOGOUT"
  end

  test "signed out, the menu has no sections" do
    sign_out
    get new_session_url
    assert_select "nav a[data-menu-key]", count: 0
  end
end
