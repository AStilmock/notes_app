require "test_helper"

class NotePadsControllerTest < ActionDispatch::IntegrationTest
  setup { @note_pad = note_pads(:one) }

  test "index lists pads" do
    get note_pads_url
    assert_response :success
    assert_select "##{dom_id(@note_pad)}"
  end

  test "create makes a blank pad at the end and opens it" do
    assert_difference("NotePad.count") { post note_pads_url }
    pad = NotePad.last
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
end
