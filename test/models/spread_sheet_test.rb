require "test_helper"

class SpreadSheetTest < ActiveSupport::TestCase
  test "new sheets start as an empty 3x3 grid at the end of their owner's list" do
    sheet = users(:one).spread_sheets.create!
    assert_equal Array.new(3) { Array.new(3, "") }, sheet.cells
    assert_equal 1, sheet.position
    assert_equal 1, users(:two).spread_sheets.create!.position
  end

  test "cells must be a rectangular grid of strings" do
    sheet = spread_sheets(:one)

    sheet.cells = [ [ "a", "b" ], [ "c" ] ]
    assert_not sheet.valid?

    sheet.cells = [ [ "a", 1 ] ]
    assert_not sheet.valid?

    sheet.cells = []
    assert_not sheet.valid?

    sheet.cells = "not a grid"
    assert_not sheet.valid?

    sheet.cells = [ [ "a", "b" ], [ "c", "d" ] ]
    assert sheet.valid?
  end

  test "grid size and cell length are capped" do
    sheet = spread_sheets(:one)

    sheet.cells = [ Array.new(SpreadSheet::MAX_COLS + 1, "") ]
    assert_not sheet.valid?

    sheet.cells = Array.new(SpreadSheet::MAX_ROWS + 1) { [ "" ] }
    assert_not sheet.valid?

    sheet.cells = [ [ "x" * (SpreadSheet::MAX_CELL_LENGTH + 1) ] ]
    assert_not sheet.valid?
  end
end
