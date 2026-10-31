class AddSizesToSpreadSheets < ActiveRecord::Migration[8.1]
  def change
    # one entry per column / row, in pixels; null (or missing) means the default size
    add_column :spread_sheets, :col_widths, :jsonb, null: false, default: []
    add_column :spread_sheets, :row_heights, :jsonb, null: false, default: []
  end
end
