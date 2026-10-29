class CreateSpreadSheets < ActiveRecord::Migration[8.1]
  def change
    create_table :spread_sheets do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.string :title, null: false, default: "Untitled"
      # array of rows, each an array of cell strings
      t.jsonb :cells, null: false, default: Array.new(3) { Array.new(3, "") }
      t.integer :position, null: false, default: 0

      t.timestamps
    end
    add_index :spread_sheets, %i[user_id position]
  end
end
