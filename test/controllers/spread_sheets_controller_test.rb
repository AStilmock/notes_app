require "test_helper"

class SpreadSheetsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @sheet = spread_sheets(:one)
    sign_in_as users(:one)
  end

  test "index lists only the signed-in user's sheets" do
    get spread_sheets_url
    assert_response :success
    assert_select "##{dom_id(@sheet)}", text: /2 × 2/
    assert_select "##{dom_id(spread_sheets(:other_users))}", count: 0
  end

  test "create makes a blank sheet and opens it" do
    assert_difference("SpreadSheet.count") { post spread_sheets_url }
    sheet = SpreadSheet.last
    assert_equal users(:one), sheet.user
    assert_redirected_to spread_sheet_url(sheet)
  end

  test "show renders the grid editor in Share Tech Mono" do
    get spread_sheet_url(@sheet)
    assert_response :success
    assert_select ".font-sheet[data-controller=spread-sheet][data-spread-sheet-cells-value=?]", @sheet.cells.to_json
  end

  test "autosave updates title and cells via turbo stream" do
    cells = [ [ "a", "b", "c" ], [ "1", "2", "3" ], [ "", "", "" ] ]
    patch spread_sheet_url(@sheet), params: { spread_sheet: { title: "Q4", cells: cells.to_json } }, as: :turbo_stream
    assert_response :success
    assert_match "replace", response.body
    @sheet.reload
    assert_equal "Q4", @sheet.title
    assert_equal cells, @sheet.cells
  end

  test "autosave saves column widths and row heights" do
    patch spread_sheet_url(@sheet), params: { spread_sheet: {
      cells: @sheet.cells.to_json, col_widths: [ 260, nil ].to_json, row_heights: [ nil, 64 ].to_json
    } }, as: :turbo_stream
    assert_response :success
    @sheet.reload
    assert_equal [ 260, nil ], @sheet.col_widths
    assert_equal [ nil, 64 ], @sheet.row_heights

    get spread_sheet_url(@sheet)
    assert_select "[data-spread-sheet-col-widths-value=?][data-spread-sheet-row-heights-value=?]", "[260,null]", "[null,64]"
  end

  test "autosave rejects out-of-range sizes" do
    patch spread_sheet_url(@sheet), params: { spread_sheet: { col_widths: [ 5 ].to_json } }, as: :turbo_stream
    assert_response :unprocessable_entity
  end

  test "autosave rejects a malformed grid" do
    patch spread_sheet_url(@sheet), params: { spread_sheet: { cells: [ [ "a" ], [ "b", "c" ] ].to_json } }, as: :turbo_stream
    assert_response :unprocessable_entity

    patch spread_sheet_url(@sheet), params: { spread_sheet: { cells: "{not json" } }, as: :turbo_stream
    assert_response :unprocessable_entity
  end

  test "destroy removes the row via turbo stream" do
    assert_difference("SpreadSheet.count", -1) do
      delete spread_sheet_url(@sheet), as: :turbo_stream
    end
    assert_match "remove", response.body
  end

  test "another user's sheet is not found" do
    other = spread_sheets(:other_users)
    get spread_sheet_url(other)
    assert_response :not_found

    delete spread_sheet_url(other), as: :turbo_stream
    assert_response :not_found
    assert SpreadSheet.exists?(other.id)
  end
end
