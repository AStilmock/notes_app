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

  test "column widths and row heights are whole pixels in range, or nil for the default" do
    sheet = spread_sheets(:one) # 2 x 2

    sheet.col_widths = [ 200, nil ]
    sheet.row_heights = [ nil, 60 ]
    assert sheet.valid?

    sheet.col_widths = [ SpreadSheet::COL_WIDTHS.max + 1 ]
    assert_not sheet.valid?

    sheet.col_widths = [ 120.5 ]
    assert_not sheet.valid?

    sheet.col_widths = []
    sheet.row_heights = [ SpreadSheet::ROW_HEIGHTS.min - 1 ]
    assert_not sheet.valid?

    sheet.row_heights = "tall"
    assert_not sheet.valid?
  end

  test "sizes for rows and columns that no longer exist are dropped" do
    sheet = spread_sheets(:one)
    sheet.update!(cells: [ [ "a" ] ], col_widths: [ 200, 300 ], row_heights: [ 40, 50 ])
    assert_equal [ 200 ], sheet.col_widths
    assert_equal [ 40 ], sheet.row_heights
  end
end
