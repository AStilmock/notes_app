require "test_helper"

class NotePadTest < ActiveSupport::TestCase
  test "new pads go to the end of their owner's list" do
    assert_equal 2, users(:one).note_pads.create!.position
    assert_equal 1, users(:two).note_pads.create!.position
  end
end
