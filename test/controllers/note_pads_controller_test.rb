require "test_helper"

class NotePadsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @note_pad = note_pads(:one)
    sign_in_as users(:one)
  end

  test "index lists only the signed-in user's pads" do
    get note_pads_url
    assert_response :success
    assert_select "##{dom_id(@note_pad)}"
    assert_select "##{dom_id(note_pads(:other_users))}", count: 0
  end

  test "create makes a blank pad at the end of the user's list and opens it" do
    assert_difference("NotePad.count") { post note_pads_url }
    pad = NotePad.last
    assert_equal users(:one), pad.user
    assert_equal "Untitled", pad.title
    assert_equal 2, pad.position
    assert_redirected_to note_pad_url(pad)
  end

  test "show renders the editor" do
    get note_pad_url(@note_pad)
    assert_response :success
    assert_select "[data-controller=note-pad] [data-note-pad-target=status]"
  end

  test "autosave update via turbo stream" do
    patch note_pad_url(@note_pad), params: { note_pad: { title: "New", body: "Hello" } }, as: :turbo_stream
    assert_response :success
    assert_equal "New", @note_pad.reload.title
  end

  test "destroy removes the row via turbo stream" do
    assert_difference("NotePad.count", -1) do
      delete note_pad_url(@note_pad), as: :turbo_stream
    end
    assert_match "remove", response.body
  end

  test "another user's pad is not found" do
    other = note_pads(:other_users)
    get note_pad_url(other)
    assert_response :not_found

    patch note_pad_url(other), params: { note_pad: { title: "Hacked" } }, as: :turbo_stream
    assert_response :not_found
    assert_equal "Not yours", other.reload.title
  end

  test "signed-out page loads redirect to login" do
    sign_out
    get note_pads_url
    assert_redirected_to new_session_url
  end

  test "signed-out autosave gets a 401 instead of a redirect" do
    sign_out
    patch note_pad_url(@note_pad), params: { note_pad: { title: "Late" } },
      headers: { "Accept" => "text/vnd.turbo-stream.html" }
    assert_response :unauthorized
    assert_equal "First pad", @note_pad.reload.title
  end
end
