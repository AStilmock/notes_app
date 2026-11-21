require "test_helper"

class NotePadTest < ActiveSupport::TestCase
  test "new pads go to the end of their owner's list" do
    assert_equal 2, users(:one).note_pads.create!.position
    assert_equal 1, users(:two).note_pads.create!.position
  end

  test "body keeps formatting tags but drops scripts, links and attributes" do
    pad = NotePad.new(body: %(<b onclick="x">bold</b> <u>u</u> <strike>s</strike><script>alert(1)</script><a href="javascript:x">link</a><div style="color:red">line</div>))
    assert_equal "<b>bold</b> <u>u</u> <strike>s</strike>alert(1)link<div>line</div>", pad.body
  end
end
