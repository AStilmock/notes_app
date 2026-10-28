require "test_helper"

class MenuTest < ActionDispatch::IntegrationTest
  test "every page has the menu bar with shortcuts" do
    get note_pads_url
    assert_select "nav[data-controller=menu]" do
      assert_select "a[data-menu-key=F1][data-menu-alt=n][href=?]", note_pads_path
    end
  end

  test "the current section is marked active" do
    get note_pad_url(note_pads(:one))
    assert_select "nav a[aria-current=page][href=?]", note_pads_path
  end
end
