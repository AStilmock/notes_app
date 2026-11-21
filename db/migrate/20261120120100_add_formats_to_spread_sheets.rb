class AddFormatsToSpreadSheets < ActiveRecord::Migration[8.1]
  def change
    add_column :spread_sheets, :formats, :jsonb, null: false, default: []
  end
end
