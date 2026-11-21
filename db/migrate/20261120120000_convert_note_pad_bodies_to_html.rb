# Note pad bodies become rich text (HTML). Escape the old plain text and keep its line breaks.
class ConvertNotePadBodiesToHtml < ActiveRecord::Migration[8.1]
  class NotePad < ActiveRecord::Base
    self.table_name = "note_pads"
  end

  def up
    NotePad.where.not(body: [ nil, "" ]).find_each do |pad|
      pad.update_columns(body: ERB::Util.html_escape(pad.body).gsub(/\r?\n/, "<br>"))
    end
  end

  def down
    NotePad.where.not(body: [ nil, "" ]).find_each do |pad|
      text = pad.body.gsub(%r{<br\s*/?>|</(div|p|li)>}i, "\n").gsub(/<[^>]*>/, "")
      pad.update_columns(body: CGI.unescapeHTML(text).chomp)
    end
  end
end
